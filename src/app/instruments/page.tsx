import { prisma } from '@/lib/prisma'
import { Suspense } from 'react'

async function InstrumentsData() {
  const merchants = await prisma.merchant.findMany({ take: 10, select: { id: true, businessName: true, city: true } })
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Database Records</h2>
      <pre className="rounded-lg bg-muted p-4 text-sm">
        {JSON.stringify(merchants, null, 2)}
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
            Data fetched from Prisma directly.
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
