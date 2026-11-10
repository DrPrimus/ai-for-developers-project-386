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
mise run fe-check     # линтер + сборка + HTTP-смоук
```

Порт 80 задан в `vite.config.ts` (`server.port` и `preview.port`). Если порт уже занят,
Vite завершится с ошибкой — это осознанное поведение (`strictPort`).

Чистый npm, без mise:

```bash
cd FE
npm install
npm run dev
npm run test   # сборка + HTTP-смоук
```

## Структура

```text
FE/
├── components.json        # конфигурация shadcn/ui CLI
├── index.html
├── vite.config.ts         # плагины React и Tailwind, алиас @, порт 80
├── scripts/
│   └── smoke.mjs          # HTTP-смоук собранного приложения
└── src/
    ├── App.tsx            # страница «Привет, мир!»
    ├── main.tsx
    ├── index.css          # Tailwind + CSS-переменные темы shadcn/ui
    ├── components/ui/     # сгенерированные компоненты shadcn/ui
    └── lib/utils.ts       # хелпер cn
```

## Тесты

`npm run test` собирает приложение и прогоняет HTTP-смоук (`scripts/smoke.mjs`):

1. поднимает `vite preview` на свободном порту (`127.0.0.1:0`, настройки порта 80
   из `vite.config.ts` переопределяются, чтобы тест не зависел от прав и занятости порта);
2. проверяет, что `GET /` отдаёт 200, `text/html`, содержит `#root` и ожидаемый `<title>`;
3. находит в HTML ссылки на JS- и CSS-бандлы и проверяет, что они отдаются с 200 и
   правильным `content-type` (ловит битую сборку, которую SPA-фолбэк маскирует под 200).

Текст страницы («Привет, мир!») смоук не проверяет: приложение рендерится в браузере,
в HTML-оболочке этого текста нет. Для проверки отрисовки нужен компонентный тест
(Vitest + Testing Library) или e2e (Playwright) — их пока нет.

## Добавление компонентов shadcn/ui

```bash
cd FE
npx shadcn@latest add dialog
```

Файлы появятся в `src/components/ui/`. Не редактируйте их стиль вручную без причины:
при повторной генерации изменения потеряются. Свои компоненты кладите в `src/components`.
