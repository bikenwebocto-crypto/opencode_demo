'use client'

import { Building2, Link2, Clock, Mail, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ReviewComponentProps } from './types'

export function SetupLinkReview({ entity, queueItem }: ReviewComponentProps) {
  const meta = (queueItem?.metadata as any) ?? {}

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Setup Link Expired
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {queueItem?.description ?? 'A company setup link has expired. Review the company and re-issue the invitation if appropriate.'}
          </p>

          {entity && (
            <div className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> {entity.name}
                  </p>
                  {entity.industry && (
                    <p className="text-xs text-muted-foreground">{entity.industry}</p>
                  )}
                </div>
                <StatusBadge status={entity.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{entity.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span>{entity._count?.employees ?? entity.employeeCount ?? 0} employees</span>
                </div>
                {entity.approvedDomain && (
                  <div className="col-span-2 text-xs text-muted-foreground">
                    Domain: {entity.approvedDomain}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            {meta.originalLinkSentAt && (
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Original Link Sent</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(meta.originalLinkSentAt).toLocaleString()}
                </p>
              </div>
            )}
            {meta.expiredAt && (
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Expired At</p>
                <p className="font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(meta.expiredAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {meta.notes && (
            <p className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
              {meta.notes}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const setupLinkEditableFields: { key: string; label: string }[] = []
