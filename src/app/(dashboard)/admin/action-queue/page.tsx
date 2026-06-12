import { Suspense } from 'react'
import ClientActionQueue from './ClientActionQueue'

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <ClientActionQueue />
    </Suspense>
  )
}
