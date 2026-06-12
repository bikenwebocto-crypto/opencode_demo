'use client'

import { Tag, Building2, AlertCircle, Mail, Phone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { ReviewComponentProps } from './types'

export function MissingPerkReview({ entity, queueItem }: ReviewComponentProps) {
  const meta = (queueItem?.metadata as any) ?? {}

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Missing Perk Alert
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-semibold">{queueItem?.title ?? 'Missing Perk'}</p>
          {queueItem?.description && (
            <p className="text-sm text-muted-foreground">{queueItem.description}</p>
          )}

          {entity && (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{(entity.businessName ?? '?').charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entity.businessName}</p>
                <p className="truncate text-xs text-muted-foreground">{entity.email}</p>
              </div>
              <StatusBadge status={entity.status} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {meta.missingSince && (
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Missing Since</p>
                <p className="font-medium">{new Date(meta.missingSince).toLocaleDateString()}</p>
              </div>
            )}
            {meta.expectedCategory && (
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Expected Category</p>
                <p className="font-medium flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {meta.expectedCategory}
                </p>
              </div>
            )}
          </div>

          {meta.note && (
            <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
              <strong>Note:</strong> {meta.note}
            </p>
          )}

          {entity?.contactPhone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" /> {entity.contactPhone}
            </div>
          )}
          {entity?.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" /> {entity.email}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const missingPerkEditableFields = [
  { key: 'businessName', label: 'Business Name' },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'contactPhone', label: 'Contact Phone' },
  { key: 'description', label: 'Description' },
  { key: 'email', label: 'Email' },
]
