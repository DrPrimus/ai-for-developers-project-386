# Issue tracker: GitHub

Issues и спеки этого репозитория живут в GitHub Issues. Все операции — через `gh` CLI.

## Conventions

- **Создать issue**: `gh issue create --title "..." --body "..."`. Многострочное тело — через heredoc.
- **Прочитать issue**: `gh issue view <number> --json number,title,body,labels,comments`.
- **Список issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` с нужными `--label` и `--state`.
- **Сделать issue дочерним**: `gh issue create --parent <parent> ...` или `gh issue edit <parent> --add-sub-issue <child>` (`gh` 2.94+). На старом `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`. Без sub-issues — `Part of #<parent>` в начале тела.
- **Блокировки**: нативные зависимости GitHub. `gh issue create --blocked-by <n>,<n> ...` или `gh issue edit <child> --add-blocked-by <blocker>` (`gh` 2.94+). На старом `gh`: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, где `blocker-db-id` — числовой database id (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), не `#number` и не `node_id`. Где зависимостей нет — строка `Blocked by: #<n>, #<n>` в начале тела. Тикет разблокирован, когда все блокеры закрыты.
- **Счёт открытых блокеров**: `gh api repos/<owner>/<repo>/issues/<n> --jq .issue_dependencies_summary.blocked_by` (0 — можно начинать). `gh issue view <n> --json blockedBy` включает и закрытые, поэтому фильтруйте: `--jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'`.
- **Комментарий**: `gh issue comment <number> --body "..."`.
- **Метки**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Закрыть**: сначала `gh issue comment <number> --body "..."`, затем `gh issue close <number>`. На уже закрытой issue `gh issue close --comment` теряет комментарий, но возвращает 0.

Репозиторий определяется из `git remote -v`; внутри клона `gh` делает это сам.

Создавайте issues только в своём репозитории. В форке `gh` может по умолчанию указывать на upstream-parent, поэтому перед первым `gh issue create` сессии проверьте цель через `gh repo view --json nameWithOwner` и подтвердите её с пользователем, если это не его репозиторий.

## Pull requests как поверхность триажа

**PRs as a request surface: no.** _(Поставьте `yes`, если репозиторий считает внешние PR заявками на фичи; `/triage` читает этот флаг.)_

Если `yes`, PR идут через те же метки и состояния, что issues, командами `gh pr`:

- **Прочитать PR**: `gh pr view <number>`, затем `gh pr view <number> --comments` (вне TTY `--comments` печатает только комментарии, без тела), диф — `gh pr diff <number>`.
- **Список внешних PR для триажа**: `gh api --paginate 'repos/{owner}/{repo}/pulls?state=open' --jq '.[] | select(.author_association | IN("OWNER","MEMBER","COLLABORATOR") | not) | {number, title, author: .user.login, author_association, labels: [.labels[].name]}'`.
- **Комментарий / метка / закрытие**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub использует единое пространство номеров для issues и PR, поэтому голый `#42` может быть и тем и другим: проверяйте через `gh pr view 42` с откатом на `gh issue view 42`.

## Когда скил просит «опубликовать в трекер»

Создайте GitHub issue.

## Когда скил просит «достать тикет»

Читайте его, как в **Прочитать issue** выше.

## Wayfinding operations

Используется `/wayfinder`. **Карта** — одна issue с **дочерними** issues-тикетами.

- **Карта**: одна issue с меткой `wayfinder:map`, в теле Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Дочерний тикет**: issue, привязанная к карте как GitHub sub-issue. Где sub-issues не включены — task list в теле карты и `Part of #<map>` в начале тела тикета. Метки: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). После захвата тикет назначен ведущему разработчику.
- **Блокировки**: см. **Блокировки** в Conventions.
- **Запрос фронтира**: открытые дети карты (`gh issue list --state open` в рамках sub-issues / task list), отбросить с открытым блокером (см. **Счёт открытых блокеров** или открытую issue из строки `Blocked by`) или с assignee; выигрывает первый в порядке карты.
- **Захват**: `gh issue edit <n> --add-assignee @me` — первая запись сессии.
- **Решение**: `gh issue comment <n> --body "<answer>"`, затем `gh issue close <n>`, затем строка-указатель (gist + ссылка) в Decisions-so-far карты.
