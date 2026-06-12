'use client'

import { AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface EntityNotFoundProps {
  referenceId?: string
  referenceType?: string
  context?: string
}

export function EntityNotFound({ referenceId, referenceType, context }: EntityNotFoundProps) {
  return (
    <Card>
      <CardContent className="py-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-2 font-medium">Referenced record not found</p>
        <p className="text-sm text-muted-foreground">
          {context ?? 'The referenced entity'} ({referenceType ?? 'unknown'}: <code className="text-xs">{referenceId ?? '—'}</code>) could not be loaded.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          You can still add remarks, view audit history, or take action on the queue item itself.
        </p>
      </CardContent>
    </Card>
  )
}
