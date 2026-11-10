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
mise run fe-check     # линтер + сборка
```

Порт 80 задан в `vite.config.ts` (`server.port` и `preview.port`). Если порт уже занят,
Vite завершится с ошибкой — это осознанное поведение (`strictPort`).

Чистый npm, без mise:

```bash
cd FE
npm install
npm run dev
```

## Структура

```text
FE/
├── components.json        # конфигурация shadcn/ui CLI
├── index.html
├── vite.config.ts         # плагины React и Tailwind, алиас @, порт 80
└── src/
    ├── App.tsx            # страница «Привет, мир!»
    ├── main.tsx
    ├── index.css          # Tailwind + CSS-переменные темы shadcn/ui
   ── components/ui/    # сгенерированные компоненты shadcn/ui
    └── lib/utils.ts       # хелпер cn
```

## Добавление компонентов shadcn/ui

```bash
cd FE
npx shadcn@latest add dialog
```

Файлы появятся в `src/components/ui/`. Не редактируйте их стиль вручную без причины:
при повторной генерации изменения потеряются. Свои компоненты кладите в `src/components`.
