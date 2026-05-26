import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'

async function InstrumentsData() {
  const supabase = await createClient()
  const { data: instruments } = await supabase.from('instruments').select()

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Database Records</h2>
      <pre className="rounded-lg bg-muted p-4 text-sm">
        {JSON.stringify(instruments, null, 2)}
      </pre>
    </div>
  )
}

export default function Instruments() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Instruments</h1>
          <p className="text-sm text-muted-foreground">
            Data fetched from Supabase via RLS (public can read).
          </p>
        </div>
        <Suspense
          fallback={
            <div className="space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-muted" />
              <div className="h-24 animate-pulse rounded bg-muted" />
            </div>
          }
        >
          <InstrumentsData />
        </Suspense>
      </div>
    </div>
  )
}
