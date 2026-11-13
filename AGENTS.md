# AGENTS.md

## Проект

Учебный проект Хекслета «AI for developers»: сервис бронирования календаря звонков. `README.md` — источник требований (сценарии, окно на 14 дней, константы рабочих часов, правила пересечения и одновременных запросов). Есть бэкенд и фронтенд; слоя хранения данных ещё нет.

## Структура

- `BE/` — модуль бэкенда (Spring Boot 4.1.2, Java 25, Maven). В корне репозитория нет сборочного файла.
- `BE/src/main/java/ru/hexlet/_6/` — базовый пакет `ru.hexlet._6`, точка входа `Application.java`. Новый код кладите в этот пакет.
- `FE/` — фронтенд: React 19, TypeScript, Vite 8, Tailwind CSS 4, UI-компоненты shadcn/ui. Алиас `@/*` → `FE/src/*`, компоненты shadcn/ui лежат в `FE/src/components/ui` и добавляются CLI (`npx shadcn@latest add <name>`), а не пишутся руками. Подробности — `FE/README.md`.
- `.github/workflows/quality-gates.yml` — CI-гейт (запускает `mise run check`: бэкенд и фронтенд).
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

Общее:

- `mise run check` — полная проверка проекта через `scripts/check.mjs`: бэкенд и фронтенд запускаются последовательно, каждый в своём блоке; после каждой части печатается сводка, в конце — общая таблица по тестам. Цифры читаются из консольного вывода Maven и Vitest, файлы отчётов не создаются
- `hk install --mise` — один раз после клона: включает git-хук `pre-commit` из `hk.pkl`, который запускает `mise run check` (бэкенд и фронтенд) на изменённые `BE/**`, `FE/**`, `mise.toml`, `hk.pkl`. Сами хуки живут в `.git/` и в репозиторий не попадают, поэтому на каждой новой машине команду нужно повторить.

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
- Несовместимое изменение — `feat!:` или `feat(be)!:`, плюс футер `BREAKING CHANGE:` с пояснением.
- Один коммит — одна логическая правка; не смешивайте фичу и форматирование.
- В истории до этого правила есть коммиты вида `#2` — их не переписывайте, правило действует для новых коммитов.

Примеры:

```text
feat(be): add meeting type creation
fix(be): reject overlapping bookings
test(be): cover concurrent slot booking
chore: apply spotless formatting
```

## Тестирование

- `/actuator/health` должен оставаться в состоянии `UP`; `ActuatorHealthTest` — smoke-тест для этого.
- Фронтенд: компонентные тесты — Vitest + Testing Library в `jsdom` (`FE/src/**/*.test.tsx`, конфиг в `FE/vite.config.ts`, setup — `FE/src/test/setup.ts`). Они входят в `npm run test` вместе со сборкой и HTTP-смоуком `FE/scripts/smoke.mjs`, который поднимает `vite preview` на свободном порту и требует 200 для `/` и бандлов. E2E пока нет — заводить на Playwright, когда появится сквозной сценарий бронирования.
- Тестам не нужна внешняя инфраструктура, поэтому `mise run check` — достаточный шаг проверки.

## Agent skills

### Issue tracker

Issues и спеки живут в GitHub Issues этого репозитория, работа через `gh` CLI. См. `docs/agents/issue-tracker.md`.

### Triage labels

Пять канонических ролей триажа с дефолтными именами меток. См. `docs/agents/triage-labels.md`.

### Domain docs

Один контекст (single-context). См. `docs/agents/domain.md`.
