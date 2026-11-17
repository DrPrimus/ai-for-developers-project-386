# AGENTS.md

## Проект

Учебный проект Хекслета «AI for developers»: сервис бронирования календаря звонков. `README.md` — источник требований (сценарии, окно на 14 дней, константы рабочих часов, правила пересечения и одновременных запросов). Есть бэкенд и фронтенд; слоя хранения данных ещё нет.

## Структура

- `BE/` — модуль бэкенда (Spring Boot 4.1.2, Java 25, Maven). В корне репозитория нет сборочного файла.
- `BE/src/main/java/ru/hexlet/_6/` — базовый пакет `ru.hexlet._6`, точка входа `Application.java`. Новый код кладите в этот пакет. Внутри: `api/` (контроллеры, DTO, обработчик ошибок), `domain/` (правила календаря и модели), `service/` (слоты, бронирование, предстоящие встречи), `store/` (хранилище в памяти), `config/` (часы сервиса), `validation/` (кастомные ограничения).
- `FE/` — фронтенд: React 19, TypeScript, Vite 8, Tailwind CSS 4, UI-компоненты shadcn/ui. Алиас `@/*` → `FE/src/*`, компоненты shadcn/ui лежат в `FE/src/components/ui` и добавляются CLI (`npx shadcn@latest add <name>`), а не пишутся руками. Свои компоненты — в `FE/src/components/booking` и `FE/src/components/admin`, единственный сетевой шов — `FE/src/api/client.ts`, форматирование дат — `FE/src/lib/datetime.ts`. Подробности — `FE/README.md`.
- `FE/e2e/` — сквозной браузерный сценарий на Playwright (`FE/playwright.config.ts` поднимает настоящий Spring Boot и собранный фронтенд).
- `api/` — контракт HTTP API на TypeSpec (Design First). Источник истины — `api/main.tsp`. Из него генерируются `api/openapi/openapi.yaml` и типы фронтенда `FE/src/api/schema.d.ts`; оба артефакта коммитятся и не редактируются руками. Бэкенд и фронтенд пишутся под этот контракт.
- `Dockerfile`, `docker/` — один production-образ: multi-stage сборка фронтенда и Spring Boot jar, в runtime nginx отдаёт SPA и проксирует `/api/` и `/actuator/` в JVM на loopback-порту `BACKEND_PORT` (по умолчанию `8081`). `docker/entrypoint.sh` запускает оба процесса и координирует завершение по SIGTERM, шаблон nginx лежит в `docker/nginx/default.conf.template`.
- `render.yaml` — Blueprint Render: сборка из корневого `Dockerfile`, health check `/actuator/health`.
- `scripts/docker-check.mjs` — сборка образа и два запуска контейнера (нестандартный порт и `PORT=8080`): health через nginx, SPA, deep link, API и graceful shutdown.
- `opencode.json`, `.env.example` — конфигурация Render MCP для OpenCode и памятка по `RENDER_API_KEY` (ключ не коммитится).
- `.github/workflows/quality-gates.yml` — CI-гейт: job `check` устанавливает Chromium и запускает `mise run check` (контракт, бэкенд, фронтенд и E2E), а отдельный job `docker` запускает `mise run docker-check`.
- `.github/workflows/hexlet-check.yml` — автогенерируемая проверка Хекслета. Не редактируйте, не удаляйте и не переименовывайте её; не переименовывайте репозиторий.

## Команды

Запускать из корня репозитория. Бэкенд-задачи работают и из подкаталогов (mise находит корневой `mise.toml`, пути в задачах указаны через `BE/`), а `fe-*` — только из корня: внутри `npm --prefix FE`, и из `BE/` npm будет искать `BE/FE`.

Бэкенд:

- `mise run be-build` — `mvnw clean compile`
- `mise run be-check` — `mvnw clean test` (полная проверка; БД и внешние сервисы не нужны)
- `mise run be-run` — запуск приложения
- `BE/mvnw -f BE/pom.xml test` — эквивалент на чистом Maven
- Один тест: `BE/mvnw -f BE/pom.xml -Dtest=ActuatorHealthTest test`

Фронтенд:

- `mise run fe-install` — `npm --prefix FE install` (зависимости в `FE/node_modules`)
- `mise run fe-run` — dev-сервер Vite на http://localhost:80; порт и `strictPort` заданы в `FE/vite.config.ts`. Порт 80 слушается на всех интерфейсах (`host: true`), иначе macOS требует root для низкого порта
- `mise run fe-build` — `npm --prefix FE run build` (`tsc -b` + сборка в `FE/dist`)
- `mise run fe-check` — `node scripts/check.mjs fe`: `oxlint`, тесты Vitest, `tsc -b`, `vite build` и HTTP-смоук по собранному `dist`; печатает сводку по шагам
- `npm --prefix FE run dev|build|lint` — те же шаги без mise (нужен установленный Node)

E2E:

- `mise run e2e-install` — один раз после установки зависимостей: ставит Chromium для Playwright (браузеры живут в кэше пользователя, в репозиторий не попадают)
- `mise run e2e` — сборка фронтенда и `npx playwright test` в `FE`: Playwright сам поднимает настоящий Spring Boot (`spring-boot:run`, ждёт `/actuator/health`) и `vite preview` с proxy `/api` → `:8080`. Каждый прогон стартует новые процессы, поэтому хранилище пустое; оба сервера останавливаются Playwright после теста

Общее:

- `mise run api-generate` — пересобрать `api/openapi/openapi.yaml` и `FE/src/api/schema.d.ts` из TypeSpec
- `mise run api-check` — проверить компиляцию TypeSpec и актуальность сгенерированных артефактов
- `mise run check` — полная проверка проекта через `scripts/check.mjs`: контракт API, бэкенд, фронтенд и E2E запускаются последовательно, каждый в своём блоке; после каждой части печатается сводка, в конце — общая таблица по тестам. Цифры читаются из консольного вывода Maven, Vitest и Playwright, файлы отчётов не создаются. Docker в этот шаг не входит — он запускается отдельным CI-job
- `hk install --mise` — один раз после клона: включает git-хук `pre-commit` из `hk.pkl`, который запускает `mise run check` (контракт API, бэкенд, фронтенд и E2E) на изменённые `api/**`, `BE/**`, `FE/**`, `docker/**`, `scripts/**`, `Dockerfile`, `render.yaml`, `opencode.json`, `.dockerignore`, `.env.example`, `mise.toml`, `hk.pkl`. Сами хуки живут в `.git/` и в репозиторий не попадают, поэтому на каждой новой машине команду нужно повторить.

Деплой и контейнер:

- `mise run docker-check` — собрать production-образ и запустить его на нестандартном порту и на `PORT=8080`; проверяет health через nginx, SPA, deep link, API и остановку по SIGTERM. Входит в отдельный job `docker` в CI, но не в `mise run check`
- `PUBLIC_URL=https://<service>.onrender.com mise run verify-public` — проверить уже развёрнутый сервис: сценарий владельца и гостя в Chromium, затем повторная бронь через API с ожиданием `409` и альтернатив. Задача сама ставит зависимости и Chromium (`fe-install` + `e2e-install`), отдельных ручных установок не требуется

## Подводный камень с форматированием

Spotless с google-java-format (стиль `GOOGLE`, отступ в 2 пробела) привязан к фазе `compile` через цель `check`, поэтому `compile`/`test`/`package` падают на неотформатированном Java-коде. Перед коммитом выполните:

```bash
BE/mvnw -f BE/pom.xml spotless:apply
```

Spotless также удаляет неиспользуемые и сортирует импорты — не форматируйте руками.

## Имена стартеров Spring Boot 4

Используйте имена стартеров из Boot 4, а не из Boot 3:

- `spring-boot-starter-webmvc` (не `spring-boot-starter-web`)
- `spring-boot-starter-webmvc-test` для тестов web-слоя
- `spring-boot-restclient` и `org.springframework.boot.resttestclient.TestRestTemplate`, если тесту нужен `TestRestTemplate`

Берите шаблоны импортов из существующих тестов, а не из примеров для Boot 3.

## Коммиты: Conventional Commits

Все новые коммиты оформляйте по [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <описание>`.

- Агент не коммитит по своей инициативе: оставьте изменения в рабочем дереве (при необходимости — в индексе) и предложите текст сообщения. Коммит выполняется только по явной просьбе человека. Это относится и к правкам вроде форматирования или документации.

- Типы: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `style`.
- Scope опционален; для этого проекта уместен `be`, например `feat(be): add meeting type endpoint`.
- Описание — в повелительном наклонении, строчными буквами, без точки в конце.
- Каждый коммит ссылается на тикет: футер `Refs: #<n>` в конце сообщения (GitHub Issues — единственный трекер, см. `docs/agents/issue-tracker.md`). Если коммит закрывает тикет — `Closes: #<n>` вместо `Refs: #<n>`; при нескольких тикетах перечислите номера через запятую. Без номера тикета коммит не считается готовым к ревью.
- Несовместимое изменение — `feat!:` или `feat(be)!:`, плюс футер `BREAKING CHANGE:` с пояснением.
- Один коммит — одна логическая правка; не смешивайте фичу и форматирование.
- В истории до этого правила есть коммиты вида `#2` — их не переписывайте, правило действует для новых коммитов.

Примеры:

```text
feat(be): add meeting type creation

Refs: #11
```

```text
fix(be): reject overlapping bookings

Closes: #13
```

```text
test(be): cover concurrent slot booking

Refs: #13
```

```text
chore: apply spotless formatting

Refs: #13
```

## Релизы

- `.github/workflows/release-please.yml` запускает `googleapis/release-please-action@v5` на push в `main`; тег и GitHub Release создаются после мержа release PR. Секретов, кроме `GITHUB_TOKEN`, не требуется.
- Релиз один на весь репозиторий: стратегия `simple` в корневом `release-please-config.json`, текущая версия — в `.release-please-manifest.json` (старт `0.1.0`). Теги — `vX.Y.Z` без префикса компонента.
- `CHANGELOG.md` и версия генерируются release-please; не редактируйте их руками. Изменения для релиза берутся из Conventional Commits.
- Все типы из раздела выше (`feat`, `fix`, `perf`, `revert`, `refactor`, `build`, `ci`, `test`, `docs`, `style`, `chore`) включены в `changelog-sections`. Scope (`be`, `fe`, `api`, …) выводится автоматически как `**scope:**`, поэтому новые scope не требуют правки конфига; новый тип коммита — требует.
- `bump-minor-pre-major: true`: до `1.0.0` несовместимые изменения поднимают minor, а не major.
- Ограничение `GITHUB_TOKEN`: созданный им release PR не запускает `pull_request`-workflow автоматически, поэтому `quality-gates` на нём может не стартовать. Его можно запустить, отправив пустой коммит в ветку `release-please--branches--main` или переоткрыв PR; после мержа `quality-gates` выполнится на push в `main`.

## Тестирование

- `/actuator/health` должен оставаться в состоянии `UP`; `ActuatorHealthTest` — smoke-тест для этого.
- Фронтенд: компонентные тесты — Vitest + Testing Library в `jsdom` (`FE/src/**/*.test.tsx`, конфиг в `FE/vite.config.ts`, setup — `FE/src/test/setup.ts`). Они входят в `npm run test` вместе со сборкой и HTTP-смоуком `FE/scripts/smoke.mjs`, который поднимает `vite preview` на свободном порту и требует 200 для `/` и бандлов.
- E2E: Playwright в Chromium (`FE/e2e/*.spec.ts`) на настоящих серверах — Spring Boot с хранилищем в памяти и собранный фронтенд. Один счастливый путь: владелец создаёт тип встречи, гость бронирует первый доступный слот из интерфейса, владелец видит встречу в предстоящих. Часы настоящие, дата не фиксируется; ошибки, конфликт и границы времени остаются на швах HTTP и компонентных тестов. Входит в `mise run check` после фронтенда.
- Бэкенд-тестам и компонентным тестам внешняя инфраструктура не нужна, но E2E поднимает настоящий Spring Boot и Chromium. Поэтому `mise run check` — достаточный шаг проверки: он прогоняет контракт, бэкенд, фронтенд и E2E, а отдельная инфраструктура нужна только для установки Chromium (`mise run e2e-install`).
- Docker: `mise run docker-check` собирает образ и проверяет контейнер на двух портах, включая graceful shutdown. Это отдельный CI-job `docker`, потому что ему нужен Docker daemon; в `mise run check` он не входит. `mise run verify-public` проверяет уже развёрнутый экземпляр по `PUBLIC_URL` и требует сеть, поэтому остаётся ручным шагом.

## Agent skills

### Issue tracker

Issues и спеки живут в GitHub Issues этого репозитория, работа через `gh` CLI. См. `docs/agents/issue-tracker.md`.

### Triage labels

Пять канонических ролей триажа с дефолтными именами меток. См. `docs/agents/triage-labels.md`.

### Domain docs

Один контекст (single-context). См. `docs/agents/domain.md`.
