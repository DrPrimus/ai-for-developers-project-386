import { Button } from '@/components/ui/button'

/** Состояние загрузки списка: показываем загрузку, ошибку с повтором или пустоту. */
export type LoadState = 'loading' | 'ready' | 'error'

type Props = {
  state: LoadState
  loadingText: string
  errorText: string
  /** Текст пустого состояния; без него готовое состояние ничего не рисует. */
  emptyText?: string
  onRetry: () => void
}

/** Одинаковый трёхсостоянийный блок списков: загрузка, ошибка с повтором и пустое состояние. */
export function LoadStateNotice({
  state,
  loadingText,
  errorText,
  emptyText,
  onRetry,
}: Props) {
  if (state === 'loading') {
    return <p className="text-sm text-muted-foreground">{loadingText}</p>
  }

  if (state === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{errorText}</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    )
  }

  if (emptyText) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return null
}
