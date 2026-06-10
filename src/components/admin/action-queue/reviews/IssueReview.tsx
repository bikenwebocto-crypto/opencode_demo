'use client'

import { AlertCircle, Building2, User, FileText, Tag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import type { ReviewComponentProps } from './types'

export function IssueReview({ entity, queueItem }: ReviewComponentProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5" />
            Issue Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{queueItem?.title ?? 'Issue'}</p>
              {queueItem?.description && (
                <p className="mt-1 text-sm text-muted-foreground">{queueItem.description}</p>
              )}
            </div>
            <StatusBadge status={entity?.status ?? 'OPEN'} />
          </div>

          {entity && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium flex items-center gap-1 capitalize">
                  <Tag className="h-3 w-3" />
                  {entity.category?.replace(/_/g, ' ') ?? 'N/A'}
                </p>
              </div>
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Priority</p>
                <p className="font-medium capitalize">{entity.priority?.replace(/_/g, ' ') ?? 'Normal'}</p>
              </div>
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">Reported</p>
                <p className="font-medium">{new Date(entity.createdAt).toLocaleDateString()}</p>
              </div>
              {entity.resolvedAt && (
                <div className="rounded-md bg-muted/30 p-2">
                  <p className="text-xs text-muted-foreground">Resolved</p>
                  <p className="font-medium">{new Date(entity.resolvedAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          )}

          {entity?.description && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <FileText className="h-3 w-3" /> Full Description
              </p>
              <p className="rounded-md bg-muted/30 p-2 text-sm text-muted-foreground">
                {entity.description}
              </p>
            </div>
          )}

          {entity?.adminNotes && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Admin Notes</p>
              <p className="rounded-md bg-primary/5 p-2 text-sm text-muted-foreground">
                {entity.adminNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {entity?.merchant && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Related Merchant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{entity.merchant.businessName}</p>
              <p className="text-xs text-muted-foreground">{entity.merchant.email}</p>
              {entity.merchant.status && <StatusBadge status={entity.merchant.status} />}
            </CardContent>
          </Card>
        )}

        {entity?.employee && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> Reported By
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">
                {entity.employee.firstName} {entity.employee.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{entity.employee.email}</p>
            </CardContent>
          </Card>
        )}

        {entity?.redemptionId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related Redemption</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Redemption ID: <code className="text-[10px]">{entity.redemptionId.slice(0, 8)}…</code>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export const issueEditableFields: { key: string; label: string }[] = []
