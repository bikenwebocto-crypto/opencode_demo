'use client'

import { Building2, Tag, MapPin, Mail, Phone, Globe, Calendar, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { ReviewComponentProps } from './types'

export function MerchantApplicationReview({ entity }: ReviewComponentProps) {
  if (!entity) return null

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Merchant Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl">
                {(entity.businessName ?? '?').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-xl font-semibold">{entity.businessName}</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={entity.status} />
                {entity.onboardingStep && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                    {entity.onboardingStep.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {entity.description && (
            <p className="text-sm text-muted-foreground">{entity.description}</p>
          )}

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {entity.contactName && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{entity.contactName}</span>
              </div>
            )}
            {entity.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{entity.email}</span>
              </div>
            )}
            {entity.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{entity.contactPhone}</span>
              </div>
            )}
            {entity.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a href={entity.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                  {entity.website}
                </a>
              </div>
            )}
            {entity.category?.name && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span>{entity.category.name}</span>
              </div>
            )}
            {entity.city && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{entity.city}{entity.state ? `, ${entity.state}` : ''}</span>
              </div>
            )}
            {entity.createdAt && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Applied {new Date(entity.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {entity.addressLine1 && (
            <div className="rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium">Address</p>
              <p>{entity.addressLine1}{entity.addressLine2 ? `, ${entity.addressLine2}` : ''}</p>
              <p>{entity.city}{entity.state ? `, ${entity.state}` : ''} {entity.postalCode ?? ''}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Business Name</span>
            <span className="font-medium">{entity.businessName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge status={entity.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Category</span>
            <span>{entity.category?.name ?? 'Uncategorized'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Featured</span>
            <span>{entity.isFeatured ? 'Yes' : 'No'}</span>
          </div>
          {entity.rejectionReason && (
            <div className="rounded-md bg-destructive/10 p-2 text-xs">
              <p className="font-medium text-destructive">Previous Rejection</p>
              <p className="text-muted-foreground">{entity.rejectionReason}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export const merchantApplicationEditableFields = [
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
