'use client'

import { Building2, Tag, MapPin, Mail, Phone, Globe, User, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { ReviewComponentProps } from './types'

interface ChangeRow { field: string; fromValue: unknown; toValue: unknown }

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v || '—'
  return JSON.stringify(v)
}

export function ProfileReview({ entity, queueItem }: ReviewComponentProps) {
  const meta = (queueItem?.metadata as any) ?? {}
  const requestedFields = (meta.requestedFields as Record<string, unknown> | undefined) ?? null
  const reason = (meta.reason as string | undefined) ?? null
  const originalValues = (meta.originalValues as Record<string, unknown> | undefined) ?? null

  const changeRows: ChangeRow[] = requestedFields
    ? Object.entries(requestedFields).map(([field, toValue]) => ({
        field,
        fromValue: originalValues?.[field] ?? null,
        toValue,
      }))
    : []

  return (
    <div className="space-y-4">
      {entity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Current Merchant Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{(entity.businessName ?? '?').charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{entity.businessName}</p>
                <StatusBadge status={entity.status} />
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {entity.contactName && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{entity.contactName}</div>}
              {entity.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{entity.email}</div>}
              {entity.contactPhone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{entity.contactPhone}</div>}
              {entity.website && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><a href={entity.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">{entity.website}</a></div>}
              {entity.category?.name && <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" />{entity.category.name}</div>}
              {entity.city && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{entity.city}{entity.state ? `, ${entity.state}` : ''}</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {reason && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Change Request Reason
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requested Changes</CardTitle>
        </CardHeader>
        <CardContent>
          {changeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No field changes recorded in metadata.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Field</th>
                    <th className="pb-2 font-medium">Current Value</th>
                    <th className="pb-2 font-medium">Requested Value</th>
                  </tr>
                </thead>
                <tbody>
                  {changeRows.map((row) => (
                    <tr key={row.field} className="border-b last:border-0">
                      <td className="py-2 font-medium capitalize">{row.field.replace(/([A-Z])/g, ' $1')}</td>
                      <td className="py-2 text-muted-foreground">{renderValue(row.fromValue)}</td>
                      <td className="py-2 font-medium text-primary">{renderValue(row.toValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const profileEditableFields = [
  { key: 'businessName', label: 'Business Name' },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'contactPhone', label: 'Contact Phone' },
  { key: 'description', label: 'Description' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'addressLine1', label: 'Address Line 1' },
]
