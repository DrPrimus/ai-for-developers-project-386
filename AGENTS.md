# AGENTS.md

## Проект

Учебный проект Хекслета «AI for developers»: сервис бронирования календаря звонков. `README.md` — источник требований (сценарии, окно на 14 дней, константы рабочих часов, правила пересечения и одновременных запросов). Сейчас есть только бэкенд; фронтенда и слоя хранения данных ещё нет.

## Структура

- `BE/` — единственный модуль приложения (Spring Boot 4.1.2, Java 25, Maven). В корне репозитория нет сборочного файла.
- `BE/src/main/java/ru/hexlet/_6/` — базовый пакет `ru.hexlet._6`, точка входа `Application.java`. Новый код кладите в этот пакет.
- `.github/workflows/quality-gates.yml` — CI-гейт (запускает `mise run check` из `BE/`).
- `.github/workflows/hexlet-check.yml` — автогенерируемая проверка Хекслета. Не редактируйте, не удаляйте и не переименовывайте её; не переименовывайте репозиторий.

## Команды

Запускать из корня репозитория (или из любого подкаталога — mise находит корневой `mise.toml`):

- `mise run build` — `mvnw clean compile`
- `mise run check` — `mvnw clean test` (полная проверка; БД и внешние сервисы не нужны)
- `mise run run` — запуск приложения
- `BE/mvnw -f BE/pom.xml test` — эквивалент на чистом Maven
- Один тест: `BE/mvnw -f BE/pom.xml -Dtest=ActuatorHealthTest test`
- `hk install --mise` — один раз после клона: включает git-хук `pre-commit` из `hk.pkl`, который запускает `mise run check`. Сами хуки живут в `.git/` и в репозиторий не попадают, поэтому на каждой новой машине команду нужно повторить.

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

- Коммит делает только человек. Агент не выполняет `git commit`: оставьте изменения в рабочем дереве (при необходимости — в индексе) и предложите текст сообщения. Это относится и к правкам вроде форматирования или документации.

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
- Тестам не нужна внешняя инфраструктура, поэтому `mise run check` — достаточный шаг проверки.
