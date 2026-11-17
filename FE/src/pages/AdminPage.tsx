import { MeetingTypesCard } from '@/components/admin/MeetingTypesCard'
import { UpcomingMeetingsCard } from '@/components/admin/UpcomingMeetingsCard'

export function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Админка
        </h1>
        <p className="text-muted-foreground">
          Управляйте типами встреч, которые видит гость на странице записи, и
          следите за предстоящими звонками.
        </p>
      </div>
      <MeetingTypesCard />
      <UpcomingMeetingsCard />
    </main>
  )
}
