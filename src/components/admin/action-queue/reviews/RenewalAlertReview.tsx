'use client'

import { AlertTriangle, User, Building2, Calendar, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ReviewComponentProps } from './types'

export function RenewalAlertReview({ entity, queueItem }: ReviewComponentProps) {
  const meta = (queueItem?.metadata as any) ?? {}

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Renewal Alert
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{queueItem?.title ?? 'Renewal Alert'}</p>
              {queueItem?.description && (
                <p className="mt-1 text-sm text-muted-foreground">{queueItem.description}</p>
              )}
            </div>
            {entity && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${entity.isDismissed ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-800'}`}>
                {entity.isDismissed ? 'Dismissed' : 'Active'}
              </span>
            )}
          </div>

          {entity && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Alert Type</p>
                <p className="font-medium capitalize">{entity.alertType?.replace(/_/g, ' ') ?? 'N/A'}</p>
              </div>
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(entity.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {entity?.message && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" /> Alert Message
              </p>
              <p className="rounded-md bg-muted/30 p-2 text-sm text-muted-foreground">
                {entity.message}
              </p>
            </div>
          )}

          {meta.employeeName && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Employee: {meta.employeeName}</span>
            </div>
          )}

          {meta.merchantName && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Merchant: {meta.merchantName}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const renewalAlertEditableFields: { key: string; label: string }[] = []
