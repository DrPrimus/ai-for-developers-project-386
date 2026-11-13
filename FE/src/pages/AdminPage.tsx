import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="font-heading text-2xl font-semibold">Админка</h1>
          </CardTitle>
          <CardDescription>Раздел в разработке.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Здесь владелец будет создавать типы встреч и видеть предстоящие
            встречи.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
