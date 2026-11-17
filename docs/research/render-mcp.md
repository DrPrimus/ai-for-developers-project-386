# Render MCP: подключение, OAuth и операции деплоя

Статус: research, не решение. Отвечает на вопросы тикета #20: точный URL и транспорт remote MCP-сервера Render, как проходит OAuth, какие инструменты нужны для Blueprint/сервиса из `render.yaml`, запуска деплоя, чтения статуса и логов, управления переменными окружения; отдельно — `PORT`, health check, free-план и обязательные поля `render.yaml` для Docker web service.

Дата доступа ко всем источникам: **2026-11-17**. Проверялись первичные источники: документация Render, OpenAPI-манифесты самого MCP-сервера (`/.well-known/...`), исходники `render-oss/render-mcp-server` (клон `main`), документация OpenCode и официального образа nginx.

## TL;DR

- Remote MCP: `https://mcp.render.com/mcp`, транспорт — **Streamable HTTP** (не SSE). stdio — только для локального запуска.
- OAuth: MCP-сервер — resource server, AS — `https://api.render.com`; PKCE S256, public clients (`token_endpoint_auth_methods_supported: ["none"]`). **Dynamic client registration не поддерживается** (`registration_endpoint` в метаданных нет, `POST /v1/oauth/register` → 404; CIMD-флаг не объявлен). Render регистрирует клиентов под конкретные приложения (`codex`, официальные плагины Claude/Cursor), поэтому для OpenCode надёжный путь — **API key в заголовке** `Authorization: Bearer <RENDER_API_KEY>` с `oauth: false`.
- Инструменты есть на всё нужное: workspace, services, **Blueprint (create/plan/approve)**, deploys (`trigger_deploy`, `list_deploys`, `get_deploy`), logs (`list_logs`), env vars (`update_environment_variables`).
- `create_web_service` **не умеет** `healthCheckPath`; Blueprint умеет. При этом `create_web_service` принимает `plan: free` (значение есть в enum, дефолт — `free`, хотя README его не перечисляет).
- Render выставляет `PORT` (по умолчанию `10000`); контейнер обязан слушать `0.0.0.0:$PORT`. Резервные порты: `18012`, `18013`, `19099`.
- Free web service: 0.1 CPU / 512 MB, засыпание через **15 минут** без входящего трафика, подъём **~1 минута** (браузеру показывается loading page), 750 free instance hours/месяц на workspace, 500 pipeline minutes/месяц на Hobby, без дисков, без scaling, без shell, без pre-deploy command.

## 1. Подключение

### 1.1. Endpoint и транспорт

| Параметр | Значение | Источник |
|---|---|---|
| URL | `https://mcp.render.com/mcp` | <https://render.com/docs/mcp-server> |
| Транспорт | Streamable HTTP (`initialize`-handshake обязателен); stdio — только локальный сервер | <https://github.com/render-oss/render-mcp-server#protocol-support> |
| Версии протокола | `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05`; sessionless `2026-07-28` — только stdio | там же |
| Аутентификация | OAuth bearer **или** Render API key в том же заголовке | <https://render.com/docs/mcp-server>, `pkg/oauth/middleware.go` |

Проверено запросом: `POST https://mcp.render.com/mcp` без токена → `401` и заголовок

```
www-authenticate: Bearer realm="https://mcp.render.com/mcp",
  resource_metadata="https://mcp.render.com/.well-known/oauth-protected-resource/mcp"
```

### 1.2. OAuth: как именно проходит

Protected resource metadata (`GET https://mcp.render.com/.well-known/oauth-protected-resource/mcp`):

```json
{
  "resource": "https://mcp.render.com/mcp",
  "authorization_servers": ["https://api.render.com"],
  "bearer_methods_supported": ["header"]
}
```

Метаданные AS (`GET https://api.render.com/.well-known/oauth-authorization-server`):

```json
{
  "issuer": "https://api.render.com",
  "authorization_endpoint": "https://api.render.com/v1/oauth/authorize",
  "token_endpoint": "https://api.render.com/v1/oauth/token",
  "revocation_endpoint": "https://api.render.com/v1/oauth/token/revoke",
  "introspection_endpoint": "https://api.render.com/v1/oauth/introspect",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "revocation_endpoint_auth_methods_supported": ["none"],
  "authorization_response_iss_parameter_supported": false
}
```

Выводы:

1. Authorization Code + PKCE (S256), refresh token поддерживается, client secret не нужен — public client.
2. **Нет `registration_endpoint`** и нет `client_id_metadata_document_supported`; `POST https://api.render.com/v1/oauth/register` возвращает `404`. Значит generic-клиент (OpenCode) не сможет сам зарегистрироваться.
3. Render документирует OAuth только для своих плагинов: Claude Code (`/plugin install render@claude-plugins-official`), Claude Desktop (коннектор Render), Cursor (`/add-plugin render`), Codex (`codex mcp add render --url https://mcp.render.com/mcp --oauth-client-id codex`). То есть `client_id` выдаётся Render'ом под приложение.
4. MCP-сервер проверяет токен через introspection, а не подписью, и **пропускает нераспознанный токен как API key** (fail-closed только при недоступности introspection — `503` + `Retry-After`). Пустой заголовок → `401` с challenge, чтобы клиент мог начать OAuth.

Источники: ответы `/.well-known` и `401` (2026-11-17), <https://render.com/docs/mcp-server>, `pkg/oauth/middleware.go`, `pkg/oauth/config.go`, `pkg/authn/authn.go` в <https://github.com/render-oss/render-mcp-server>.

### 1.3. API key — рабочий путь для агента

Render API key создаётся на <https://dashboard.render.com/u/settings?add-api-key> (<https://render.com/docs/api#1-create-an-api-key>). Заголовок: `Authorization: Bearer <RENDER_API_KEY>`. Схема `Bearer` необязательна — парсер принимает и голый токен (`pkg/authn/authn.go`), но `Bearer` безопаснее.

OpenCode, remote-сервер с OAuth (сработает только если появится зарегистрированный `client_id`):

```jsonc
{
  "mcp": {
    "servers": {
      "render": { "type": "remote", "url": "https://mcp.render.com/mcp" }
    }
  }
}
```

OpenCode, API key (рекомендуется; `oauth: false` обязателен, иначе OpenCode попытается регистрироваться и упадёт):

```jsonc
{
  "mcp": {
    "servers": {
      "render": {
        "type": "remote",
        "url": "https://mcp.render.com/mcp",
        "oauth": false,
        "headers": { "Authorization": "Bearer {env:RENDER_API_KEY}" }
      }
    }
  }
}
```

CLI-эквивалент: `opencode mcp add render --url https://mcp.render.com/mcp --header 'Authorization=Bearer {env:RENDER_API_KEY}'` (синтаксис `NAME=value` из <https://opencode.ai/docs/mcp-servers/>), затем `opencode mcp list` / `/mcps`, при OAuth — `opencode mcp auth render`.

OpenCode использует Streamable HTTP, OAuth по умолчанию, PKCE, CIMD → DCR → pre-registered client. Для Render остаётся только pre-registered `client_id` (`oauth.client_id`) — но публично выданного Render'ом client id для OpenCode нет (см. «Неопределённости»).

### 1.4. Workspace

Каждый вызов ресурсного инструмента принимает необязательный `workspaceId`. `select_workspace`/`get_selected_workspace` — deprecated, привязка к MCP-сессии ненадёжна при реконнекте. Правильно: один раз `list_workspaces`, дальше передавать `workspaceId` в каждый вызов.

## 2. Инструменты Render MCP (сигнатуры)

Полный список проверен в исходниках (`grep 'NewTool("' pkg`): `list_workspaces`, `select_workspace`, `get_selected_workspace`, `list_services`, `get_service`, `create_web_service`, `create_static_site`, `create_cron_job`, `run_cron_job`, `cancel_cron_job_run`, `update_web_service`, `update_static_site`, `update_cron_job`, `update_environment_variables`, `list_deploys`, `get_deploy`, `trigger_deploy`, `list_events`, `list_logs`, `list_log_label_values`, `get_metrics`, `list_postgres_instances`, `get_postgres`, `create_postgres`, `query_render_postgres`, `list_key_value`, `get_key_value`, `create_key_value`, `create_blueprint`, `get_blueprint`, `plan_blueprint`, `approve_blueprint`, `update_blueprint`, плюс workflow-инструменты. Инструмента «прочитать env vars» нет.

### 2.1. Workspaces

| Tool | Параметры |
|---|---|
| `list_workspaces` | — |
| `select_workspace` | `ownerID: string` (required; deprecated) |
| `get_selected_workspace` | — |

### 2.2. Services

| Tool | Параметры |
|---|---|
| `list_services` | `includePreviews?: boolean` (default `false`), `workspaceId?: string` |
| `get_service` | `serviceId: string` (required) |
| `create_web_service` | `name` (req), `runtime` (req: `node`/`python`/`go`/`rust`/`ruby`/`elixir`/`docker`), `buildCommand` (req кроме docker), `startCommand` (req кроме docker), `dockerfilePath?` (default `./Dockerfile`), `dockerContext?` (default `.`), `dockerCommand?`, `repo?`, `branch?`, `plan?` (enum включает `free`, default `free`), `autoDeploy?: "yes"\|"no"` (default `yes`), `region?` (`oregon` default, `frankfurt`, `singapore`, `ohio`, `virginia`), `envVars?: [{key, value}]`, `workspaceId?` |
| `update_environment_variables` | `serviceId` (req), `envVars: [{key, value}]` (req), `replace?: boolean` (default `false` = **merge**), `workspaceId?` |
| `update_web_service` | `serviceId` — заглушка: возвращает ссылку в Dashboard, изменений не делает |

Важные факты, проверенные по коду (`pkg/service/tools.go`):

- `create_web_service` **не принимает `healthCheckPath`** и не умеет image-backed сервисы.
- `plan` в README перечислен только платными значениями, но в коде enum = `free` + все `PaidPlan`, а `mcp.DefaultString(PlanFree)`; тест `TestServicePlanEnumValues` специально охраняет наличие `free`. То есть `create_web_service(... plan: "free")` валиден.
- `update_environment_variables` по умолчанию **сливает** со старыми значениями (читает `ListEnvVars`), `replace: true` — заменяет полностью; после записи **сам триггерит деплой**, чтобы переменные применились.

### 2.3. Blueprints (public alpha)

| Tool | Параметры |
|---|---|
| `create_blueprint` | `repoUrl` (req, `https://`/`ssh://`, без query/fragment; SCP-style `git@host:path` не принимается), `branch?`, `path?` (default `render.yaml`), `name?`, `autoSync?: boolean` (default `true`), `existingResources?: "create_new"\|"adopt"` (default `create_new`), `workspaceId?` |
| `get_blueprint` | `blueprintId: string` (`exs-...`), `workspaceId?` — статус, настройки, ID ресурсов; `status` описывает sync, не здоровье сервиса |
| `plan_blueprint` | `blueprintId`, `workspaceId?` — планирует изменения по ветке/пути из настроек Blueprint |
| `approve_blueprint` | `blueprintId` (не sync ID), `manualEnvVars?: [{serviceType, serviceName, key, value}]`, `workspaceId?` — применяет **последний успешно спланированный** sync |
| `update_blueprint` | `blueprintId`, `name?`, `branch?`, `path?`, `autoSync?` — хотя бы одно поле |

Ключевые ограничения (README + `pkg/blueprint/tools.go`):

- Инструменты в **public alpha**, контракт может меняться.
- Все Blueprint-изменения читаются из **удалённого** репозитория: локальные правки нужно запушить и передать `repoUrl`/`branch`.
- `create_blueprint` только планирует первый sync; применение — `approve_blueprint` после ревью плана. `approve` возвращает состояние sync и `dashboardUrl` **до** завершения деплоев.
- Если в `render.yaml` есть `envVars: [{key, sync: false}]`, `approve_blueprint` требует `manualEnvVars` для каждого такого ключа (`serviceType` ∈ `buildSource`/`cron`/`pserv`/`web`/`worker`/`workflow`). Для агентского сценария лучше не использовать `sync: false`, а брать `generateValue: true` или некритичные значения.
- Планирование/approve не должны выполняться для failed/пустых планов.

### 2.4. Deploys, status, logs, events

| Tool | Параметры |
|---|---|
| `trigger_deploy` | `serviceId` (req), `clearCache?: boolean` (default `false`) |
| `list_deploys` | `serviceId` (req) |
| `get_deploy` | `serviceId` (req), `deployId` (req) |
| `list_logs` | `resource: string[]` (req — ID сервиса, `srv-...`), `level?`, `type?`, `text?`, `startTime?`, `endTime?` (RFC3339), `instance?`, `host?`, `statusCode?`, `method?`, `path?`, `direction?`, `limit?` |
| `list_log_label_values` | `label` (req), `resource` (req), остальные фильтры как у `list_logs` |
| `list_events` | `serviceId` (req), `eventTypes?: string[]`, `startTime?`, `endTime?`, `limit?` (1–100, default 20), `cursor?` |

Статусы деплоя (enum из `pkg/client/types_gen.go`): `created`, `queued`, `build_in_progress`, `build_failed`, `pre_deploy_in_progress`, `pre_deploy_failed`, `update_in_progress`, `update_failed`, `live`, `deactivated`, `canceled`.

Практика:

- `trigger_deploy` отвечает быстро и может вернуть «запрос принят, деплой ещё не создан» — тогда поллить `list_deploys`.
- Инструмента «ждать завершения» нет: цикл `get_deploy` до `live`/`*_failed`/`canceled`.
- `list_logs` не фильтруется по `deployId`; логи сборки/рантайма различаются через `type`, а границу — через `startTime`/`endTime`. Причина падения (OOM, non-zero exit, failed health check) надёжнее видна в `list_events` (`server_failed`, `build_ended`, `deploy_ended`, `pipeline_minutes_exhausted`).
- `trigger_deploy` после пуша при `autoDeploy` не нужен — push уже запускает деплой (описание инструмента прямо это говорит).

## 3. `PORT` в Docker-сервисах

- Каждый web service обязан слушать порт на `0.0.0.0`; Render проксирует публичный HTTP на этот порт, напрямую из интернета он недоступен (<https://render.com/docs/web-services#port-binding>).
- «The default value of `PORT` is `10000` for all Render web services. You can override this value by setting the environment variable» (там же). В списке default env vars `PORT` описан как опциональная переменная с дефолтом `10000` (<https://render.com/docs/environment-variables>). Практический вывод: читать `PORT` и иметь фолбэк `10000`.
- Резервные порты, которые нельзя занимать: `18012`, `18013`, `19099`. Free web service тоже не может на них биндиться (<https://render.com/docs/free>).
- Публичный HTTP-порт **один**; дополнительные порты можно открывать только для private network. Для одного контейнера это значит: nginx слушает `$PORT`, Spring Boot — внутренний `8080`, наружу `8080` не публикуется.
- Docker-специфика: `buildCommand`/`startCommand` для `runtime: docker` не задаются, запускается `CMD`/`ENTRYPOINT` (либо `dockerCommand`); env vars транслируются в Docker build args **и** доступны в рантайме — секреты в build args попадать не должны (<https://render.com/docs/docker>).

## 4. Health checks

- По умолчанию — TCP-проба на открытый порт (для web service это публичный HTTP-порт, обычно `10000`). Для web service можно включить HTTP-проверку через `healthCheckPath` (обязан начинаться с `/`).
- Успех: TCP-соединение принято за **5 секунд**; HTTP — ответ `2xx`/`3xx` за **5 секунд**. Иначе — fail.
- Новый деплой: трафик не переключается, пока **все** новые инстансы одновременно не пройдут проверки; если за **15 минут** это не произошло — деплой отменяется, трафик остаётся на старой версии.
- Работающий инстанс: 15 секунд подряд fail → временно исключается из балансировки; 60 секунд подряд fail → автоматический restart.
- `Host` для HTTP health check — verified custom domain, иначе `onrender.com`-сабдомен. Nginx не должен отбрасывать такой Host.
- Timeout сборки — 120 минут, pre-deploy — 30 минут, start command — 15 минут (<https://render.com/docs/deploys>).

Источник: <https://render.com/docs/health-checks>.

## 5. Free plan: лимиты и поведение

| Ограничение | Значение |
|---|---|
| Compute | 0.1 CPU / 512 MB RAM (`plan: free`) |
| Засыпание | после **15 минут** без входящего HTTP/WebSocket-трафика |
| Подъём | по следующему запросу, **~1 минута**; браузеру показывается loading page |
| Free instance hours | 750/месяц на workspace; исчерпание → все free web services suspended до начала месяца |
| Pipeline minutes | Hobby — **500/месяц** (общие для билдов; исчерпание → новые билды отключены до конца месяца / докупка) |
| Диски | нельзя (persistent disk недоступен) |
| Scaling | только 1 инстанс |
| Pre-deploy command | недоступен на free |
| Shell/SSH | недоступен |
| Filesystem | ephemeral, теряется при деплое/рестарте/засыпании |
| Прочее | Render может рестартовать сервис в любой момент; `/robots.txt` в спящем состоянии отвечает `Disallow: /` без пробуждения; исходящие порты 25/465/587 закрыты; free web service не принимает private-network трафик |

Источники: <https://render.com/docs/free>, <https://render.com/docs/build-pipeline>, <https://render.com/docs/compute-plans>.

Следствия для этого проекта: JVM + nginx в 512 MB — тесно; холодный старт после 15 минут простоя = ~1 минута ожидания (для E2E и для проверяющего это нормально, но health-check и первый запрос должны это переживать). Blueprint с `plan: free` валиден (пример в docs использует `plan: free` для web service).

## 6. `render.yaml` для Docker web service

### 6.1. Обязательные и значимые поля

| Поле | Обязательность | Комментарий |
|---|---|---|
| `name` | **required** | уникально в Blueprint |
| `type` | **required** | `web` |
| `runtime` | **required** (кроме keyvalue) | `docker` |
| `plan` | опционально | `free` допустим; дефолт для нового сервиса — `0.5c-512mb` (для Blueprint), у MCP `create_web_service` дефолт — `free` |
| `repo` | опционально | если нет — репозиторий, содержащий `render.yaml` |
| `branch` | опционально | если нет — ветка Blueprint (для сервиса из того же репо) |
| `region` | опционально | `oregon` (default), `ohio`, `virginia`, `frankfurt`, `singapore`; менять после создания нельзя |
| `autoDeployTrigger` | опционально | `commit` (default) / `checksPass` / `off`; deprecated-алиас `autoDeploy: true\|false` |
| `dockerfilePath` | опционально | default `./Dockerfile`, относительно корня репо |
| `dockerContext` | опционально | default — корень репо |
| `dockerCommand` | опционально | иначе `CMD` из Dockerfile |
| `healthCheckPath` | опционально | только web; включает HTTP health check |
| `envVars` | опционально | `value`, `generateValue`, `sync: false`, `fromDatabase`, `fromService`, `fromGroup` |
| `maxShutdownDelaySeconds` | опционально | 1–300, default 30 |
| `buildCommand` / `startCommand` | **не нужны** для docker | для docker их задавать нельзя |

Источник: <https://render.com/docs/blueprint-spec>. Валидация: `render blueprints validate render.yaml`, JSON Schema — <https://render.com/schema/render.yaml.json>, API — Validate Blueprint endpoint.

Существующие env vars Render при sync **сохраняет**, даже если их нет в YAML; Blueprint может их добавлять и переопределять. Удаление ресурса из YAML ресурс не удаляет.

### 6.2. Предлагаемый `render.yaml` (черновик, не решение)

Файла `Dockerfile` в репозитории пока нет, как и `render.yaml`; Blueprint без Dockerfile упадёт на сборке.

```yaml
services:
  - type: web
    name: booking-386
    runtime: docker
    plan: free
    region: frankfurt
    autoDeployTrigger: commit
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /actuator/health
    envVars:
      - key: JAVA_TOOL_OPTIONS
        value: -XX:MaxRAMPercentage=70
      - key: SPRING_PROFILES_ACTIVE
        value: prod
```

`repo`/`branch` можно не указывать: Blueprint возьмёт свой репозиторий и ветку. `dockerContext: .` нужен, потому что в корне лежат и `BE/`, и `FE/`, а Dockerfile будет собирать оба.

## 7. Один контейнер: nginx на `$PORT` + Spring Boot на 8080

Подводные камни, каждый — из первичного источника:

1. **Nginx должен слушать `$PORT`, а не 80.** Render проксирует только публичный порт; `listen 80` приведёт к «failed to detect open port» и падению деплоя (<https://render.com/docs/web-services#port-binding>).
2. **`envsubst` в официальном образе nginx заменяет все `$var`.** Образ рендерит `/etc/nginx/templates/*.template` через `envsubst`, а `NGINX_ENVSUBST_FILTER` по умолчанию пуст, то есть подстановка идёт по всем переменным окружения. Без фильтра `$uri`, `$host`, `$proxy_add_x_forwarded_for` в конфиге станут пустыми. Решение — `NGINX_ENVSUBST_FILTER=^PORT$` (переменная окружения контейнера) или экранирование; в шаблоне — `listen ${PORT};` (<https://github.com/docker-library/docs/blob/master/nginx/content.md>, раздел «Using environment variables in nginx configuration»).
3. **Health check идёт с `Host: <service>.onrender.com`.** Конфиг nginx должен иметь catch-all/`default_server` (или явно этот Host); иначе `/actuator/health` вернёт 404 и деплой не станет `live`.
4. **Health check надо проксировать в Spring, а не отдавать статикой.** Если `healthCheckPath` обслуживается nginx с диска, деплой переключится на новый инстанс до готовности JVM. Правильно: `location = /actuator/health { proxy_pass http://127.0.0.1:8080; }` и `management.endpoints.web.exposure.include` с `health` в Spring.
5. **Spring Boot должен слушать `0.0.0.0:8080`.** Loopback-only (`127.0.0.1`) внутри контейнера ещё работает для nginx, но `server.address: 0.0.0.0` безопаснее; контейнер не должен пытаться читать `PORT` как свой порт.
6. **PID 1 и SIGTERM.** Render при деплое шлёт `SIGTERM` процессу приложения и через `maxShutdownDelaySeconds` (default 30) — `SIGKILL` (<https://render.com/docs/deploys#graceful-shutdown>). В контейнере PID 1 — то, что задано в `CMD`. Если это `nginx -g 'daemon off;'` с Java в фоне, nginx не перешлёт сигнал JVM, а `docker stop`/Render убьёт контейнер по таймауту. Нужен супервизор (например, `supervisord`, `s6-overlay`, `tini` + скрипт с `trap`) либо shell-скрипт как PID 1, который запускает оба процесса и на `SIGTERM` сначала останавливает nginx, затем JVM.
7. **Гонка старта: nginx поднялся раньше JVM.** Прокси на `127.0.0.1:8080` до готовности Spring даст `502` — это нормально для health check (он не `2xx`), но не нормально для `healthCheckPath`, указывающего на статику (см. п. 4). Логично добавить `proxy_next_upstream`/ретраи не нужно: health check сам ретраится каждые несколько секунд в течение 15 минут.
8. **512 MB на двоих.** JVM в контейнере видит cgroup-лимит 512 MB; дефолтный `MaxRAMPercentage=25` даёт ~128 MB heap, чего Spring Boot хватает с трудом при пиковой нагрузке, а nginx и metaspace/`-Xss` тоже требуют памяти. `-XX:MaxRAMPercentage=70` — разумная отправная точка; OOM-kill виден в `list_events` как `server_failed`, а не только в логах.
9. **0.1 CPU на free.** Старт JVM на 0.1 CPU ощутимо медленный; при 15-минутном окне health check деплой обычно успевает, но холодный старт после засыпания + JVM = больше минуты. Для E2E это надо закладывать в таймауты.
10. **Docker build args = env vars.** Render транслирует env vars в build args; секреты в Dockerfile `ARG` попадут в образ (<https://render.com/docs/docker#environment-variable-translation>). Секреты — только в рантайм, при необходимости secret files.
11. **Сборка идёт на build-машине, а не на 0.1 CPU инстансе**, и списывает pipeline minutes; multi-stage и кэш слоёв важны: Maven-сборка Spring Boot + `npm run build` для Vite — самые дорогие шаги.
12. **Корень репозитория без сборочного файла.** Для Docker это не проблема (собирает Dockerfile), но `dockerContext: .` означает, что в контекст попадут `BE/target`, `FE/node_modules`, `FE/dist`, `.git`. Нужен `.dockerignore`; иначе контекст раздувается и кэш ломается.

## 8. Сценарий «агент деплоит без кликов»

1. Один раз: API key → OpenCode `mcp.servers.render` с `oauth: false` и заголовком; `opencode mcp list` → `connected`.
2. `list_workspaces` → выбрать `workspaceId`.
3. Убедиться, что `render.yaml` и `Dockerfile` **запушены** в GitHub (Blueprint читает удалённый репозиторий).
4. `create_blueprint {repoUrl: "https://github.com/DrPrimus/ai-for-developers-project-386", branch: "main", path: "render.yaml", workspaceId}`.
5. `get_blueprint`/`create_blueprint` → `planningOutcome`; если план успешен — `approve_blueprint {blueprintId, workspaceId}` (при `sync: false` — с `manualEnvVars`).
6. `list_services` → найти `srv-...`; поллить `list_deploys`/`get_deploy` до `live`; при失败 — `list_events` + `list_logs`.
7. Дальнейшие правки кода — push в `main` при `autoDeployTrigger: commit` (деплой запустится сам; `trigger_deploy` не нужен). Правки env — `update_environment_variables` (merge по умолчанию, деплой триггерится автоматически).

Репозиторий публичный (`gh repo view`: `visibility: PUBLIC`), поэтому `create_blueprint` не требует подключённого Git provider — публичный URL принимается.

## 9. Неопределённости

- **OAuth для OpenCode.** В метаданных AS нет DCR и CIMD, публичного `client_id` для OpenCode Render не документирует. Возможно, Render выдаёт client id партнёрам/по запросу, но подтверждения нет. Пока единственный проверяемый путь — API key.
- **`PORT` как env var.** Документация называет `PORT` «optional» с дефолтом `10000`, а не «Render всегда выставляет». Код/поведение платформы не проверялись на живом сервисе; надёжно: `listen ${PORT:-10000}` в шаблоне nginx (но `envsubst` не умеет `:-`, поэтому дефолт придётся задавать через `ENV PORT=10000` в Dockerfile).
- **Ресурсы build-машины** (memory limit при Docker build) в документации не указаны; таймаут сборки — 120 минут.
- **Blueprint-инструменты в alpha**: контракт `approve_blueprint`/`create_blueprint` может измениться; поведение `sync.requiredManualEnvVars` описано только README/кодом.
- **Точные значения `type` для логов сборки** (`build`/`deploy`) в enum не зафиксированы; фильтровать придётся по `text`/`startTime` или через `list_events`.
- **Тарифные имена планов в MCP** (`starter`, `standard`, `pro`, `pro_plus`, `pro_ultra`) не совпадают с именами compute plans в Blueprint (`0.5c-512mb`, `1c-2g`, …). Для Blueprint использовать blueprint-имена, для `create_web_service` — MCP-имена; `free` работает в обоих.

## Источники (доступ 2026-11-17)

- Render MCP Server: <https://render.com/docs/mcp-server>
- Render MCP Server README (полный список инструментов и параметров): <https://github.com/render-oss/render-mcp-server>
- Исходники MCP-сервера (`main`): `pkg/service/tools.go`, `pkg/deploy/tools.go`, `pkg/blueprint/tools.go`, `pkg/oauth/middleware.go`, `pkg/authn/authn.go`, `pkg/client/types_gen.go`, `pkg/mcpserver/common.go`
- OAuth-метаданные (проверены запросом): `https://mcp.render.com/.well-known/oauth-protected-resource/mcp`, `https://api.render.com/.well-known/oauth-authorization-server`
- Web Services / port binding: <https://render.com/docs/web-services#port-binding>
- Default environment variables: <https://render.com/docs/environment-variables>
- Docker on Render: <https://render.com/docs/docker>
- Deploys (шаги, таймауты, graceful shutdown, zero-downtime): <https://render.com/docs/deploys>
- Health Checks: <https://render.com/docs/health-checks>
- Free plan: <https://render.com/docs/free>
- Build pipeline / pipeline minutes: <https://render.com/docs/build-pipeline>
- Blueprint YAML Reference: <https://render.com/docs/blueprint-spec>
- Blueprints (IaC): <https://render.com/docs/infrastructure-as-code>
- Render API keys: <https://render.com/docs/api#1-create-an-api-key>
- OpenCode MCP servers (remote, OAuth, конфиг): <https://opencode.ai/docs/mcp-servers/>
- Официальный образ nginx, envsubst-шаблоны: <https://github.com/docker-library/docs/blob/master/nginx/content.md>
