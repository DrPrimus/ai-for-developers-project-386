import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function BookingPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="font-heading text-2xl font-semibold">
              Запись на встречу
            </h1>
          </CardTitle>
          <CardDescription>Раздел в разработке.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Здесь появится выбор типа встречи и календарь свободных слотов на
            ближайшие две недели.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
