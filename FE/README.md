# FE — фронтенд «Календаря звонков»

Одностраничное приложение на React + TypeScript, собранное Vite, с UI-компонентами
[shadcn/ui](https://ui.shadcn.com/) (Tailwind CSS v4).

## Стек

- [Vite](https://vite.dev/) 8 + TypeScript 7
- React 19
- Tailwind CSS 4 (`@tailwindcss/vite`)
- shadcn/ui: стиль `radix-nova`, иконки `lucide-react`, алиас `@/*` → `src/*`

## Запуск

Из корня репозитория (mise ставит нужную версию Node из `mise.toml`):

```bash
mise run fe-install   # установить зависимости
mise run fe-run       # dev-сервер на http://localhost:80
mise run fe-build     # production-сборка в FE/dist
mise run fe-check     # линтер + тесты, сборка + HTTP-смоук
```

Порт 80 задан в `vite.config.ts` (`server.port` и `preview.port`). Если порт уже занят,
Vite завершится с ошибкой — это осознанное поведение (`strictPort`).

Чистый npm, без mise:

```bash
cd FE
npm install
npm run dev
npm run test   # компонентные тесты, сборка + HTTP-смоук
```

## Структура

```text
FE/
├── components.json        # конфигурация shadcn/ui CLI
├── e2e/                   # Playwright: сквозной сценарий и global setup
├── index.html
├── playwright.config.ts   # webServer: настоящий Spring Boot + vite preview
├── vite.config.ts         # плагины React и Tailwind, алиас @, порт 80, конфиг Vitest
├── scripts/
│   └── smoke.mjs          # HTTP-смоук собранного приложения
└── src/
    ├── App.tsx            # маршруты и общий каркас приложения
    ├── main.tsx
    ├── index.css          # Tailwind + CSS-переменные темы shadcn/ui
    ├── api/
    │   ├── client.ts      # единственный сетевой шов: типизированные функции API
    │   └── schema.d.ts    # сгенерированные из OpenAPI типы, не редактируются руками
    ├── components/
    │   ├── LoadStateNotice.tsx  # общий блок «загрузка / ошибка с повтором / пусто»
    │   ├── admin/         # карточки типов встреч и предстоящих встреч
    │   ├── booking/       # выбор типа встречи и календарь слотов
    │   ├── layout/        # SiteHeader и другие элементы каркаса
    │   └── ui/            # сгенерированные компоненты shadcn/ui
    ├── pages/             # HomePage, BookingPage, AdminPage и их тесты
    ├── test/
    │   ├── setup.ts       # jest-dom и очистка DOM между тестами
    │   └── fixtures.ts    # общие фикстуры компонентных тестов
    └── lib/
        ├── datetime.ts    # форматирование дат и времени в часовом поясе сервиса
        └── utils.ts       # хелпер cn
```

Маршруты: `/` — главная (витрина сервиса), `/booking` — запись гостя, `/admin` — админка владельца. Навигация — `react-router`.

## Тесты

Компонентные тесты — Vitest + `@testing-library/react` в `jsdom`; файлы лежат рядом с
компонентами (`src/**/*.test.tsx`). Тест главной проверяет тексты, `href` кнопки записи
и переходы по ссылкам хедера.

`npm run test` (и `mise run fe-check`) прогоняет всё по порядку:

1. `vitest run` — компонентные тесты;
2. `tsc -b && vite build` — сборка;
3. `scripts/smoke.mjs` — HTTP-смоук собранного приложения:

   - поднимает `vite preview` на свободном порту (`127.0.0.1:0`, настройки порта 80
     из `vite.config.ts` переопределяются, чтобы тест не зависел от прав и занятости порта);
   - проверяет, что `GET /` отдаёт 200, `text/html`, содержит `#root` и ожидаемый `<title>`;
   - проверяет, что прямые ссылки `GET /booking` и `GET /admin` тоже отдают 200 и
     HTML с `#root` (SPA-фолбэк работает, а не 404);
   - находит в HTML ссылки на JS- и CSS-бандлы и проверяет, что они отдаются с 200 и
     правильным `content-type` (ловит битую сборку, которую SPA-фолбэк маскирует под 200).

Отдельно: `npm run test:unit` — только компонентные тесты, `npm run test:watch` — режим
наблюдения.

## E2E

Сквозной сценарий — Playwright в Chromium (`e2e/*.spec.ts`, конфиг `playwright.config.ts`).
Конфиг поднимает два сервера: настоящий Spring Boot (`BE/mvnw spring-boot:run`, ждёт
`/actuator/health`) и собранный фронтенд (`vite preview` на порту 4173, proxy `/api` →
`:8080`). Оба процесса новый запуск создаёт заново, поэтому хранилище всегда пустое.

```bash
mise run e2e-install   # один раз: Chromium для Playwright
mise run e2e           # сборка + npx playwright test
```

Без mise: `cd FE && npx playwright install chromium && npm run build && npm run e2e`.
Сценарий не фиксирует дату: слот выбирается из интерфейса первым доступным.

## Добавление компонентов shadcn/ui

```bash
cd FE
npx shadcn@latest add dialog
```

Файлы появятся в `src/components/ui/`. Не редактируйте их стиль вручную без причины:
при повторной генерации изменения потеряются. Свои компоненты кладите в `src/components`.
