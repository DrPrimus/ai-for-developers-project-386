# OpenCode: проектный MCP-конфиг для remote Render

Статус: research, не решение. Отвечает на вопросы тикета #21: точная схема проектного MCP-конфига OpenCode V2, транспорт и поля remote-сервера, OAuth и хранение кредов, безопасный для коммита фрагмент для Render, проверка подключения и приоритет конфигов.

Проверено на OpenCode **v2.2.5** (локальный бинарь и `opencode --help`), документация V2 — по состоянию на **2026-11-17**. Термины проекта — по `GLOSSARY.md`; MCP-сервер здесь не часть домена бронирования, а инструмент разработки.

## 0. Краткий ответ

1. Проектный конфиг — `opencode.json` (или `opencode.jsonc`) **в корне репозитория** либо `.opencode/opencode.json(c)`. Серверы лежат под `mcp.servers.<name>`; в V2 имена серверов **не** кладутся напрямую под `mcp`.
2. Remote-сервер: `type: "remote"` + абсолютный `url` (Streamable HTTP). Поля `enabled` нет — есть `disabled: true`.
3. OAuth включён для remote-серверов по умолчанию; `oauth: false` его выключает. Креды хранятся **вне** проектного конфига, в пользовательском хранилище OpenCode, поэтому конфиг без секретов можно коммитить.
4. Render hosted MCP: `https://mcp.render.com/mcp`. **Но на 2026-11-17 OAuth-вход в Render из OpenCode не завершается**: authorization server Render не публикует ни dynamic client registration (DCR), ни CIMD, а OpenCode без pre-registered `client_id` умеет получать клиента только этими двумя способами. Это известный баг Render MCP (issue #25) и подтверждается живыми метаданными Render. Рабочий на сегодня вариант — API key через `{env:RENDER_API_KEY}` и `oauth: false`; он тоже безопасен для коммита, потому что в файле нет самого ключа.
5. `.env.example` для OAuth не нужен. Для API-key варианта он полезен только как документация: OpenCode сам `.env` не читает, переменную надо экспортировать в окружении процесса.

## 1. Где лежит проектный конфиг

Документация V2 перечисляет два равноправных места:

```text
<repo>/opencode.json(c)
<repo>/.opencode/opencode.json(c)
```

- Формат — JSON или JSONC (комментарии и trailing comma допустимы).
- `$schema: "https://opencode.ai/config.json"` даёт валидацию и автодополнение в редакторе; схема — источник истины по полям.
- `opencode mcp add render --url https://mcp.render.com/mcp` без `--global` пишет сервер именно в **проектный** `opencode.json` в текущем каталоге. Это проверено локально на v2.2.5: команда создала `opencode.json` без `$schema`, поэтому при ручном добавлении `$schema` стоит дописать.
- `--global` пишет в `~/.config/opencode/opencode.json(c)` и делает сервер доступным во всех проектах; для командного конфига это не то, что нужно.

В репозитории `opencode.json` сейчас нет, так что файл создаётся с нуля.

## 2. Схема `mcp`

Корневой ключ — `mcp`, внутри — `servers` (карта «имя → объект сервера») и необязательный `timeout` с дефолтами.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "my-server": {
        "type": "remote",
        "url": "https://mcp.example.com/mcp",
      },
    },
  },
}
```

Поля remote-сервера (по документации V2):

| Поле | Обязательное | Значение |
|---|---|---|
| `type` | да | Строго `"remote"`. |
| `url` | да | Абсолютный endpoint MCP Streamable HTTP. |
| `headers` | нет | HTTP-заголовки, значения — строки; поддерживают `{env:NAME}`. |
| `oauth` | нет | Объект настроек OAuth либо `false`. По умолчанию OAuth **включён**. |
| `disabled` | нет | `true` — сервер остаётся в конфиге, но не подключается. По умолчанию `false`. |
| `codemode` | нет | `false` — отдавать инструменты напрямую, а не через Code Mode. По умолчанию `true`. |
| `timeout` | нет | Переопределения таймаутов: `startup`, `catalog`, `execution` (целые миллисекунды). |
| `protocol` | нет | `legacy` (по умолчанию), `auto` или `2026-07-28`. |
| `pool` | нет | `true` — делить одно соединение между каталогами. По умолчанию `false`. |

Важно: поля `enabled` в V2 **нет**. Если скопировать конфиг из Claude Desktop/Cursor с `mcpServers` или добавить `enabled: true`, OpenCode либо проигнорирует ключ, либо не увидит серверы вовсе — частая причина сообщения `No MCP servers configured`.

Таймауты по умолчанию: `startup` — 30 с (соединение и инициализация), `catalog` — 30 с (список tools/prompts/resources), `execution` — 12 часов (вызов инструмента). Глобальные дефолты задаются в `mcp.timeout`, объект `timeout` конкретного сервера перекрывает совпадающие ключи.

OAuth-объект использует snake_case (V2):

| Поле | Назначение |
|---|---|
| `client_id` | Pre-registered client ID; приоритетнее CIMD и DCR. |
| `client_secret` | Секрет confidential-клиента; для public-клиента не нужен. |
| `scope` | Скоупы через пробел. |
| `callback_port` | Локальный порт callback, 1–65535. |
| `redirect_uri` | Pre-registered loopback URI; отключает CIMD. |
| `auth_server_metadata_url` | Metadata URL auth-сервера, если MCP-сервер не публикует protected-resource metadata. |

Для Render по умолчанию ничего из этого не требуется — и именно в этом проблема (раздел 4).

## 3. OAuth и где хранятся креды

- Remote-серверы используют OAuth, пока не указано `oauth: false`.
- OpenCode сам обнаруживает authorization server, входит по PKCE и обновляет токены.
- Документация прямо говорит: **credentials are stored outside project configuration**. В проектном `opencode.json` токенов нет и быть не должно.
- Локально (`opencode debug paths` на v2.2.5) пользовательские данные лежат в `~/.local/share/opencode`; в `opencode.db` есть общая таблица `credential`. Формат хранения документацией не описан — это наблюдение, а не контракт. Полагаться надо на документированную операцию удаления:

```sh
opencode mcp logout render
```

- `opencode mcp auth render` запускает тот же вход из CLI, но это интерактивный flow; в агенте его запускать не следует — ссылку авторизации можно потерять в фоновом выводе. Пользовательский путь — `/mcps` в OpenCode, выбрать сервер и войти.
- Каждый разработчик входит **своим** аккаунтом Render. Общий закоммиченный конфиг не делает креды общими и ничего не авторизует сам по себе.

## 4. Render: URL и реальность OAuth на 2026-11-17

Hosted-сервер Render (рекомендуемый самим Render вместо локального запуска):

```text
https://mcp.render.com/mcp
```

Render описывает OAuth-подключение через свои плагины для Claude Code, Claude Desktop, Codex и Cursor; для Codex в их документации даже указан явный pre-registered client: `codex mcp add render --url https://mcp.render.com/mcp --oauth-client-id codex`. OpenCode в списке поддерживаемых клиентов Render **нет**.

Живая проверка метаданных 2026-11-17:

```sh
curl -s https://mcp.render.com/.well-known/oauth-protected-resource/mcp
# {"resource":"https://mcp.render.com/mcp","authorization_servers":["https://api.render.com"],"bearer_methods_supported":["header"]}

curl -s https://api.render.com/.well-known/oauth-authorization-server
# issuer https://api.render.com, authorization/token/revocation/introspection endpoints,
# grant_types authorization_code + refresh_token, PKCE S256,
# token_endpoint_auth_methods_supported: ["none"]
# НЕТ registration_endpoint и НЕТ client_id_metadata_document_supported
```

Это значит:

- **DCR (RFC 7591)** Render не предоставляет — регистрация клиента «на лету» невозможна.
- **CIMD** (Client ID Metadata Document) Render не анонсирует, поэтому OpenCode не выберет этот путь: по документации CIMD используется, только когда auth-сервер его поддерживает.
- Без `oauth.client_id` OpenCode доходит до шага получения client ID и падает. Это не ошибка конфига, а пробел на стороне Render.
- Пробел зафиксирован в issue Render MCP: <https://github.com/render-oss/render-mcp-server/issues/25> («auth server metadata advertises neither DCR nor CIMD»). На дату проверки issue открыт, метаданные не изменились.
- Проба `authorize` с `client_id=claude` проходит дальше (Render знает этот pre-registered клиент), а `opencode` и URL-форма CIMD дают `400`. Полагаться на чужой `client_id` нельзя: redirect URI чужого клиента не зарегистрирован, и это обход, а не решение.

Практические следствия:

1. OAuth-фрагмент ниже **синтаксически правильный и безопасный для коммита**, но вход в Render из OpenCode сегодня, скорее всего, не завершится.
2. Рабочий вариант на сейчас — API key Render в заголовке `Authorization: Bearer`, подставленный из переменной окружения. Render документирует этот способ как альтернативу OAuth для неинтерактивных окружений.
3. Когда Render добавит DCR/CIMD или зарегистрирует клиента для OpenCode, достаточно будет убрать `oauth: false` и `headers` — остальной фрагмент не меняется.

Отдельно: после подключения Render требует выбрать workspace. Это не поле конфига, а промпт агенту: «Set my Render workspace to <name>».

## 5. Готовые фрагменты

### 5.1. OAuth-вариант (целевой, без секретов)

`opencode.json` в корне репозитория:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "render": {
        "type": "remote",
        "url": "https://mcp.render.com/mcp"
      }
    }
  }
}
```

`oauth` можно не указывать: для remote-сервера он включён по умолчанию. Писать `oauth: {}` не нужно, а `oauth: false` отключил бы OAuth. Секретов в файле нет. Этот фрагмент можно коммитить, но на 2026-11-17 он приведёт к `needs authentication` и неудачной попытке входа (раздел 4).

### 5.2. Рабочий вариант на сейчас: API key из окружения

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "render": {
        "type": "remote",
        "url": "https://mcp.render.com/mcp",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:RENDER_API_KEY}"
        }
      }
    }
  }
}
```

`{env:RENDER_API_KEY}` подставляется при загрузке конфига. В файле только имя переменной, поэтому фрагмент безопасен для коммита. Если переменная не задана, подстановка даёт пустую строку — сервер получит `Authorization: Bearer ` и ответит 401; это главный симптом забытого экспорта.

### 5.3. Что коммитить

- Если нужен работающий у всех сервер **сегодня** — вариант 5.2 плюс договорённость, что у каждого разработчика экспортирован `RENDER_API_KEY`.
- Если нужен именно OAuth — вариант 5.1; он корректен по схеме, но до исправления на стороне Render вход не заработает. Коммитить его «на будущее» можно, однако `opencode mcp list` будет показывать `needs authentication`.
- Смешивать нельзя: при `oauth: false` заголовок обязателен, при OAuth заголовок `Authorization` не нужен и может конфликтовать с токеном.

## 6. Как проверить, что сервер подключён

```sh
opencode mcp list
```

Ожидаемые состояния по документации:

```text
✓ render  connected              # подключён, инструменты доступны агенту
⚠ render  needs authentication   # сервер найден, но вход не выполнен
```

- Если `needs authentication` — открыть `/mcps`, выбрать `render`, войти в браузере (для OAuth-варианта).
- Если `No MCP servers configured` — проверить, что ключ называется `mcp.servers` (не `mcpServers`), что файл лежит в корне или в `.opencode/`, и что JSON валиден. На v2.2.5 первый запуск в свежем каталоге может напечатать это сообщение, пока поднимается фоновый сервис; повторный запуск показывает реальное состояние.
- Для API-key варианта при ошибке подключения проверить, что переменная видна процессу: `printenv RENDER_API_KEY` в том же shell, откуда запускается OpenCode.
- В агенте при включённом Code Mode (по умолчанию) инструменты видны как `tools.render.<tool>`; отключить группировку можно `"codemode": false`.
- Правки конфига применяются без перезапуска; принудительно перезагрузить — `/reload`. Перезапускать OpenCode после редактирования не нужно.

## 7. Приоритет проектного и глобального конфигов

Порядок из документации V2 (от низшего к высшему):

1. `~/.config/opencode/opencode.json(c)` — глобальный.
2. `opencode.json(c)` в предках текущего каталога, от дальнего к ближнему.
3. `.opencode/opencode.json(c)` в тех же каталогах (перекрывает direct-конфиги).
4. `/etc/opencode/opencode.json(c)` (Linux) или `/Library/Application Support/opencode` (macOS) — системный.
5. Managed preferences (macOS) — выше всего.

Для MCP действует отдельное правило: конфиг с более высоким приоритетом **целиком заменяет объект сервера с тем же именем**, а не сливает поля. Поэтому:

- проектный `render` перекрывает глобальный `render` целиком; если в глобальном были свои `headers`/`timeout`, в проекте их надо повторить;
- если у разработчика глобально настроен другой `render` (например, с личным API key), проектный конфиг его скроет;
- чтобы не конфликтовать с личными настройками, можно назвать сервер иначе (`render-project`), но тогда инструменты будут `render_project_*`.

## 8. Нужен ли `.env.example`

- **Для OAuth-варианта — нет.** Переменные окружения не нужны, а файл с `RENDER_API_KEY=` подтолкнул бы хранить ключ в репозитории.
- **Для API-key варианта — полезен как документация**, но не как механизм: OpenCode не загружает `.env` автоматически, `{env:...}` читает окружение процесса. Нужно экспортировать переменную в shell/IDE/CI.
- В репозитории сейчас нет ни `.env.example`, ни правила `.env` в `.gitignore`. Если заводить пример, стоит одной строкой:
  ```dotenv
  # Render API key (Account Settings → API Keys). Export in your shell; do not commit real values.
  RENDER_API_KEY=
  ```
  и добавить `.env` в `.gitignore`. Без этого `.env.example` — просто памятка, а не рабочая конфигурация.

## 9. Выводы

1. Схема проектного конфига: `opencode.json` в корне, ключ `mcp.servers.render`, `type: "remote"`, `url: "https://mcp.render.com/mcp"`. `enabled` не существует; отключение — `disabled: true`.
2. OAuth в OpenCode для remote-серверов включён по умолчанию; токены живут вне репозитория, удаляются `opencode mcp logout render`. Конфиг без секретов коммитить безопасно.
3. Render сегодня не даёт OpenCode завершить OAuth: в метаданных нет DCR и CIMD, а pre-registered клиента для OpenCode Render не публикует. Это внешний блокер, а не ошибка формата.
4. Рабочий безопасный для коммита вариант — `oauth: false` + `Authorization: Bearer {env:RENDER_API_KEY}`; ключ хранится только в окружении.
5. Проверка — `opencode mcp list` (`✓ connected` / `⚠ needs authentication`), вход — `/mcps`, приоритет — проектный конфиг перекрывает глобальный целым объектом сервера.

## Источники

Доступ ко всем URL — 2026-11-17.

### OpenCode V2

- MCP servers (поля, remote, OAuth, CIMD/DCR, `/mcps`, `mcp list`, таймауты, `pool`, `codemode`, `disabled`): <https://opencode.ai/v2/docs/mcp-servers>
- Config (расположение `opencode.json(c)`, `$schema`, приоритет, подстановка `{env:...}`, `mcp.servers`): <https://opencode.ai/v2/docs/config>
- Схема конфига: <https://opencode.ai/config.json>
- Индекс документации V2: <https://opencode.ai/v2/llms.txt>

### Render

- Render MCP Server (hosted URL, OAuth через плагины, API-key заголовок, workspace, ограничения): <https://render.com/docs/mcp-server>
- Render MCP issue #25 — «OAuth fails in Claude Code: auth server metadata advertises neither DCR nor CIMD»: <https://github.com/render-oss/render-mcp-server/issues/25>
- Protected resource metadata: <https://mcp.render.com/.well-known/oauth-protected-resource/mcp>
- Authorization server metadata: <https://api.render.com/.well-known/oauth-authorization-server>

### Локальные наблюдения (OpenCode v2.2.5)

- `opencode mcp add render --url https://mcp.render.com/mcp` создаёт проектный `opencode.json` без `$schema`.
- `opencode debug paths` → данные в `~/.local/share/opencode`, конфиг в `~/.config/opencode`, БД `opencode.db`.
- `opencode mcp list` в свежем каталоге: сначала `No MCP servers configured`, после подъёма сервиса — `⚠ render  needs authentication`.
