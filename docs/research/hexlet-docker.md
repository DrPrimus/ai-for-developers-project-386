# Требования Хекслета к Dockerfile и PORT: исследование

Статус: research, не решение. Отвечает на вопросы тикета #22: из какого каталога автопроверка Хекслета собирает образ, какой командой запускает контейнер, как передаёт `PORT`, что считает успешным стартом и есть ли требования к базовому образу, непривилегированному пользователю и `docker-compose`.

Дата доступа ко всем источникам: **2026-11-17**. Проверялись первичные источники: исходники `Hexlet/project-action` (ветки `master` и `release`), публичный образ проверки этого проекта на Docker Hub (файлы внутри образа: `README.md`, `__data__/checklist.md`, `__data__/review-checklist.md`, `__data__/steps/60-deploy.md`, `docker-compose.yml`, `Makefile`, `__tests__`), справочная статья Хекслета об автопроверке и документация Render по привязке порта.

## TL;DR

- Автопроверка **действительно собирает `Dockerfile` из корня репозитория студента** — но не своим кодом, а `Makefile` из образа проверки: `docker build -t calendar-slot-code:local -f code/Dockerfile code`. Здесь `code/` — это корень репозитория студента, поэтому контекст сборки = корень репозитория, а путь к Dockerfile = `Dockerfile` в корне.
- Контейнер запускается командой `docker run --rm --name calendar-slot-code --network container:$HOSTNAME -e PORT=8080 calendar-slot-code:local`: **никаких других переменных окружения, томов и переопределений `CMD` нет**. Приложение обязано стартовать само.
- `PORT` передаётся только в рантайме, фиксированным значением **`PORT=8080`** (не `$PORT` хоста, не build-arg). Приложение должно слушать `8080` и быть доступным по сети контейнера (`0.0.0.0`), иначе Playwright не достучится по `http://calendar.test:8080`.
- Успешный старт: healthcheck `curl -fsS http://localhost:8080/` (интервал 2 с, таймаут 1 с, 300 ретраев, `start_period` 10 с — запас около 10 минут), затем Playwright `page.goto("/")` с ожиданием **ровно `200`**. Отдельный health-эндпоинт не нужен и не проверяется.
- Требований к базовому образу и непривилегированному пользователю **нет**. Ограничение только одно: образ должен собираться и запускаться на Linux **amd64** (раннер `ubuntu-latest`). `EXPOSE` не обязателен.
- `docker-compose.yml` студента **не используется**: проверка принудительно берёт свой `-f docker-compose.yml` и игнорирует `docker-compose.override.yml`. Свой compose держать можно, на проверку он не влияет.
- Публичный URL и деплой автопроверка **не проверяет** — это делает наставник по чек-листу. Требования к деплою (Render/Railway, ссылка в README) записаны в шаге `60-deploy.md`, но не в коде проверки.
- Важное следствие для нашего деплоя: при `PORT=8080` nginx на `$PORT` и Spring Boot на внутреннем `8080` конфликтуют. Внутренний порт Java должен быть не `8080` (например, `8081`), либо nginx слушает `8080`, а Java — другой порт. Это нужно учесть в task-тикете про Dockerfile.

## 1. Что делает автопроверка: общий механизм

Workflow в репозитории (`hexlet-check.yml`) вызывает `hexlet/project-action@release` с `hexlet-id` из секрета. Ветка `release` и `master` в `Hexlet/project-action` содержат одинаковый `src/index.js` (проверено `git show origin/release:src/index.js`).

Ключевые места `src/index.js` (<https://github.com/Hexlet/project-action/blob/master/src/index.js>):

```js
const projectImageName = `hexletprojects/${projectMember.project.image_name}:latest`;
// ...
const copyCmd = `docker run -v ${mountPath}:/mnt ${projectImageName} bash -c "cp -r /project/. /mnt/source && rm -rf /mnt/source/code"`;
await exec.exec(copyCmd, null, cmdOptions);
await io.mkdirP(codePath);
await io.cp(`${projectPath}/.`, codePath, { recursive: true });
await exec.exec('docker', ['build', '--cache-from', projectImageName, '.'], {
  ...cmdOptions,
  cwd: projectSourcePath,
});
```

То есть раннер:

1. тянет образ проекта `hexletprojects/<image_name>:latest`;
2. распаковывает из него «харнесс» проекта в `/var/tmp/source`, удаляя каталог `code`;
3. копирует туда репозиторий студента целиком (включая `.git`) в `/var/tmp/source/code`;
4. собирает Dockerfile харнесса (`docker build .`) — **не** Dockerfile студента;
5. запускает проверку:

```js
const composeFile = ['-f', 'docker-compose.yml'];
await exec.exec('docker compose', [...composeFile, 'run', '--rm', 'app', 'make', 'setup'], options);
// ...
const verdictArgs = hasTestService
  ? [...composeFile, 'run', '--rm', 'test']
  : [...composeFile, 'up', '--abort-on-container-exit'];
```

Вердикт — код выхода сервиса `test` (фолбэк `up --abort-on-container-exit` для образов без `test`). Падение `make setup` роняет проверку раньше тестов. При падении печатаются логи compose (`docker compose logs --no-color --tail 200`), а из `/project/tmp/artifacts/` выгружается артефакт `test-results`.

Два важных ограничения:

- Если Хекслет отдаёт `projectMember.tests_on == false`, экшен пишет `Tests will run during review step` и завершается успешно, ничего не собирая. Это же описано в справке: «До отправки на проверку экшен запускается на каждом коммите, но тесты не прогоняет. В его логе стоит предупреждение Tests will run during review step» (<https://help.hexlet.io/project-work/avtoproverka-proektov>).
- Проверка тянет `:latest`, поэтому требования могут измениться без изменения репозитория студента. Всё ниже — снимок образа от 2026-11-13.

## 2. Проверка именно этого проекта

Нужный харнесс опубликован: `hexletprojects/ai_assisted_development_calendar_slot_project_ru` (Docker Hub, `last_updated` 2026-11-13T15:49:36Z, digest `sha256:c40cbb38f447275f4c85da4ac7f7e93ccc2743cc6cef394c8565f8914849493b`). Есть и вариант второго проекта — `hexletprojects/ai_assisted_development_calendar_advanced_project_ru` (2026-11-12), у него тот же docker-контракт.

`README.md` внутри образа прямо описывает проверку:

> Проверка Хекслета собирает `code/Dockerfile`, запускает контейнер с `PORT=8080` и проверяет `GET /` с ответом `200`. Этот уровень не знает маршрутов API и структуры приложения студента.

`__data__/checklist.md` (тот же текст видит студент в задании):

> Автоматическая проверка собирает образ по _Dockerfile_ из корня репозитория, запускает контейнер с переменной `PORT=8080` и ждёт, что главная страница ответит кодом 200.
>
> Для проверки в репозитории должны быть два файла, остальная структура остаётся на ваше усмотрение: `.github/workflows/hexlet-check.yml` и `Dockerfile`.
>
> Контейнер из собранного образа запускает приложение сам, без дополнительных команд. Приложение слушает порт из переменной окружения `PORT`. Если _Dockerfile_ в корне репозитория нет, проверка падает на сборке с сообщением `open Dockerfile: no such file or directory`.

`__data__/steps/60-deploy.md` (требования шага деплоя):

> - В корне репозитория должен лежать файл _Dockerfile_. По нему в проверке собирается образ и запускается приложение.
> - При запуске контейнера из собранного образа приложение должно стартовать автоматически.
> - Приложение должно запускаться в контейнере по порту из переменной окружения `PORT`. Эта переменная используется и при деплое, и в автоматической проверке проекта.
> - После деплоя у приложения должна быть публичная ссылка, и она добавлена в репозиторий.

`__data__/review-checklist.md` (для наставника) уточняет границу:

> Автопроверка собирает `code/Dockerfile`, поднимает контейнер с `PORT=8080` и проверяет, что `GET /` вернул `200`. Про контракт, бронирования, занятость слотов, тесты и трекер она не знает ничего.
>
> …Образ собирается, приложение стартует само и слушает порт из `PORT`. В _README.md_ есть ссылка на опубликованное приложение, и по ней сервис отвечает.

### 2.1. Точные команды харнесса

`Makefile` внутри образа:

```make
setup:
	@make code-setup

code-setup:
	docker build -t $(APP_IMAGE) -f code/Dockerfile code

code-run:
	@make code-stop
	docker run --rm --name $(APP_CONTAINER) -p 8080:8080 -e PORT=8080 $(APP_IMAGE)

code-run-compose:
	@make code-stop
	docker run --rm --name $(APP_CONTAINER) --network container:$$HOSTNAME -e PORT=8080 $(APP_IMAGE)
```

где `APP_IMAGE ?= calendar-slot-code:local`, `APP_CONTAINER ?= calendar-slot-code`.

`docker-compose.yml` харнесса:

```yaml
services:
  app:
    build:
      context: .
    volumes:
      - .:/project
      - /var/run/docker.sock:/var/run/docker.sock
      - node_modules:/project/node_modules
    command: make code-run-compose
    deploy:
      resources:
        limits:
          cpus: 0.7
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8080/ >/dev/null || exit 1"]
      interval: 2s
      timeout: 1s
      retries: 300
      start_period: 10s
    networks:
      default:
        aliases:
          - calendar.test
  test:
    build:
      context: .
    volumes:
      - .:/project
      - node_modules:/project/node_modules
    command: make test
    environment:
      BASE_URL: http://calendar.test:8080
    depends_on:
      app:
        condition: service_healthy
```

`__tests__/00-smoke.spec.ts`:

```ts
test("smoke: application opens", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
});
```

`playwright.config.ts` харнесса: `testDir: "__tests__"`, `BASE_URL ?? http://localhost:8080`, `timeout: 10_000`, `navigationTimeout: 5_000`, один воркер, отчёты и трейсы в `tmp/artifacts/`.

### 2.2. Как это складывается в запуск

1. `docker compose -f docker-compose.yml run --rm app make setup` → `docker build ... -f code/Dockerfile code`. Контекст — корень репозитория студента, доступны `BE/`, `FE/`, `api/` и т.д. Build-args не передаются.
2. Контейнер `app` (харнесс) монтирует `/var/run/docker.sock` и запускает `docker run ... -e PORT=8080 <образ студента>`; студенческий контейнер разделяет network namespace с `app` (`--network container:$HOSTNAME`), поэтому `localhost:8080` в healthcheck и `calendar.test:8080` в тестах ведут в сеть студенческого контейнера.
3. Healthcheck ждёт до ~10 минут (`2s × 300` + `start_period 10s`). Только после `service_healthy` стартует `test`.
4. `test` запускает Playwright и требует `200` на `/`. Код выхода `test` — вердикт проверки.

## 3. Ответы на вопросы тикета

| Вопрос | Ответ |
|---|---|
| Из какого каталога собирается образ | Контекст — **корень репозитория студента**; путь к Dockerfile — `Dockerfile` в корне (`docker build -f code/Dockerfile code`, где `code` = корень репозитория). |
| Команда сборки | `docker build -t calendar-slot-code:local -f code/Dockerfile code`. Без `--build-arg`, без `--platform`, без `--target`; собирается финальная стадия. |
| Команда запуска | `docker run --rm --name calendar-slot-code --network container:<app> -e PORT=8080 calendar-slot-code:local`. Без томов, без `CMD`-override, без дополнительных env. |
| Как передаётся `PORT` | Только в рантайме: `-e PORT=8080`. В сборке `PORT` не задаётся. Приложение должно читать `PORT` и слушать `0.0.0.0:8080`. |
| Что считается успешным стартом | `GET /` отвечает `200` (Playwright), плюс healthcheck `curl -fsS http://localhost:8080/`. Отдельный health-эндпоинт не требуется. |
| Таймауты | Healthcheck: интервал 2 с, таймаут 1 с, 300 ретраев, `start_period` 10 с → ~10 минут на старт. Playwright: 10 с на тест, 5 с на навигацию. |
| Требования к базовому образу | Нет. Кроме практического: образ должен собираться и работать на Linux **amd64** (раннер `ubuntu-latest`); не пинить `--platform=linux/arm64`. |
| Непривилегированный пользователь | Нет требований. Контейнер запускается с пользователем из образа; `root` допустим. |
| `docker-compose` | Не участвует. Проверка берёт свой compose и игнорирует `docker-compose.override.yml`; compose студента не читается. |
| Публичный URL / деплой | Автоматически **не проверяется**. Проверяет наставник: ссылка в `README.md`, по ней проходится сценарий. |
| Прочие требования | Нет `HEALTHCHECK`/`EXPOSE`; нет требования к имени файла, кроме `Dockerfile` в корне; нет ограничения на размер образа, но время сборки входит в проверку. |

## 4. Что это значит для нашего репозитория

- **Dockerfile обязателен и лежит в корне.** Сейчас его в репозитории нет — автопроверка упадёт на сборке с `open Dockerfile: no such file or directory`.
- **Контекст сборки — корень**, поэтому multi-stage образ может копировать `BE/`, `FE/`, `api/`; `.dockerignore` обязателен, иначе в контекст попадут `.git`, `FE/node_modules`, `BE/target`, `FE/dist` и т.п.
- **Образ должен запускать оба процесса сам** (Java + nginx) без внешних env, кроме `PORT`. Spring Boot не должен требовать `BASE_URL`, БД или профилей.
- **Порт.** Проверка даёт `PORT=8080`; Render даёт свой `PORT` (по умолчанию `10000`) и требует `0.0.0.0`. Практично: nginx слушает `${PORT:-8080}`, Spring Boot — отдельный внутренний порт.
- **Конфликт портов при `PORT=8080`.** Решение карты «nginx на `$PORT`, Spring Boot на фиксированном `8080`» при проверке даёт коллизию: оба процесса захотят `8080`. Внутренний порт Java нужно сделать отличным от `8080` (например, `8081`, `server.address=127.0.0.1`) или наоборот — nginx на `8080`, Java на другом. Это правка в task-тикете про Dockerfile, карту не меняет.
- **`/` должен отвечать `200`** и отдавать реальное приложение (главную страницу). Редирект `/` → `/admin` допустим только если итоговый ответ `200`; healthcheck `curl -f` не следует редиректам, но принимает `3xx`, а Playwright идёт по редиректу.
- **Health-эндпоинт.** `HEALTHCHECK` в Dockerfile не нужен — харнесс проверяет сам. Для Render `healthCheckPath` (`/actuator/health`) — отдельная история (см. `docs/research/render-mcp.md`).
- **Холодный старт ≤ ~10 минут.** Сборку (Maven/npm) лучше делать на этапе `docker build`, а не при старте контейнера.
- **Архитектура.** Локальная сборка на Apple Silicon должна проверяться под `linux/amd64` (`docker build --platform linux/amd64`), иначе расхождение с раннером.
- **Непривилегированный пользователь и базовый образ** — на наш выбор; на проверку не влияют. Если добавляем `USER`, убедиться, что entrypoint и nginx могут писать в нужные каталоги.
- **Свой `docker-compose.yml`** можно держать для локальной разработки, но проверка его игнорирует; полагаться на него в сдаче нельзя.
- **Деплой.** Публичная ссылка и работающий по ней сценарий — требование шага и ревью, а не автопроверки. Порядок: Render/Railway, `PORT`, ссылка в `README.md`, MCP-конфиг, отсутствие секретов.

## 5. Уверенность

**Высокая** для вопроса «что делает автопроверка с корневым Dockerfile и `PORT`»: есть исходники экшена и публичный образ проверки именно этого проекта, где требования продублированы в `README.md`, чек-листе студента, чек-листе наставника и шаге деплоя, а команды сборки и запуска видны в `Makefile`/`docker-compose.yml`.

Оговорки:

- Образ проверки тегается `:latest`; требования могут измениться без изменений в репозитории. Снимок — 2026-11-13.
- Не проверялось на живом прогоне, включён ли `tests_on` для этого проекта; если выключен, экшен до ревью только пишет предупреждение и не собирает образ.
- Ручную проверку публичной ссылки и README выполняет наставник; автоматического деплой-чека в экшене нет.
- Общий гайд Хекслета по деплою (<https://ru.hexlet.io/courses/java-web/lessons/deploy/theory_unit>) подтверждает практику «Dockerfile в корне → Render», но урок доступен только в интерфейсе курса; здесь он использован как вспомогательный источник, а не как основание.

## 6. Источники

| Источник | Что взято | Дата доступа |
|---|---|---|
| <https://github.com/Hexlet/project-action> (`src/index.js`, `action.yml`, `README.md`, ветки `master`/`release`) | Механизм: образ проекта, копирование репозитория в `code/`, `docker build`, `make setup`, вердикт по сервису `test`, артефакты, гейт `tests_on` | 2026-11-17 |
| <https://hub.docker.com/r/hexletprojects/ai_assisted_development_calendar_slot_project_ru> (`:latest`, digest `sha256:c40cbb38f447275f4c85da4ac7f7e93ccc2743cc6cef394c8565f8914849493b`, образ от 2026-11-13) | `README.md`, `__data__/checklist.md`, `__data__/review-checklist.md`, `__data__/steps/60-deploy.md`, `docker-compose.yml`, `Makefile`, `__tests__/00-smoke.spec.ts`, `playwright.config.ts` | 2026-11-17 |
| <https://hub.docker.com/r/hexletprojects/ai_assisted_development_calendar_advanced_project_ru> | Второй проект: тот же контракт сборки/запуска/`PORT`/`GET /` | 2026-11-17 |
| <https://help.hexlet.io/project-work/avtoproverka-proektov> | Автопроверка запускается на шаге ревью; до него — `Tests will run during review step`; где смотреть лог и артефакты | 2026-11-17 |
| <https://render.com/docs/web-services#port-binding> | `PORT` (дефолт `10000`), обязательная привязка к `0.0.0.0`, зарезервированные порты | 2026-11-17 |
| <https://ru.hexlet.io/courses/java-web/lessons/deploy/theory_unit> | Гайд Хекслета: Dockerfile в корне, Render собирает образ, `Root Directory` пустой (вспомогательный источник; урок за авторизацией) | 2026-11-17 |
| <https://github.com/ditransler/ai-for-developers-project-386>, <https://github.com/alexmyt/ai-for-developers-project-386>, <https://github.com/kolchenko/ai-for-developers-project-387> | Публичные студенческие проекты этого курса: корневой Dockerfile, запуск по `PORT`, деплой на Render | 2026-11-17 |

### Как воспроизвести inspect образа

```bash
docker pull hexletprojects/ai_assisted_development_calendar_slot_project_ru:latest
docker run --rm --entrypoint sh hexletprojects/ai_assisted_development_calendar_slot_project_ru:latest -c '
  cat /project/README.md;
  cat /project/__data__/checklist.md;
  cat /project/__data__/review-checklist.md;
  cat /project/__data__/steps/60-deploy.md;
  cat /project/docker-compose.yml;
  cat /project/Makefile;
  cat /project/__tests__/00-smoke.spec.ts;
  cat /project/playwright.config.ts
'
docker image inspect hexletprojects/ai_assisted_development_calendar_slot_project_ru:latest \
  --format '{{json .RepoDigests}} {{.Created}}'
```
