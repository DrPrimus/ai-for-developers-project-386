import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function App() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="size-5" />
            Привет, мир!
          </CardTitle>
          <CardDescription>
            Календарь звонков — фронтенд на Vite, TypeScript и shadcn/ui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Эта страница подтверждает, что приложение собрано и запущено.
            Дальше здесь появятся типы встреч и календарь на 14 дней.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <a href="https://ui.shadcn.com/docs" target="_blank" rel="noreferrer">
              Документация shadcn/ui
            </a>
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}

export default App
