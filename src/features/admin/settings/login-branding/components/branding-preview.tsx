'use client'

import type { LoginBrandingData } from '../schemas/login-branding.schema'
import { LoginLayoutRenderer } from '@/components/login-layouts'

interface BrandingPreviewProps {
  data: LoginBrandingData
}

export function BrandingPreview({ data }: BrandingPreviewProps) {
  const brandingWithLayout = { ...data, layout: data.layout ?? 'SPLIT_CARD' }

  return (
    <div className="overflow-hidden rounded-xl border shadow-lg">
      <LoginLayoutRenderer branding={brandingWithLayout} compact>
        <div className="w-full space-y-3">
          <div className="text-center">
            <p className="text-lg font-semibold">Sign In</p>
          </div>
          <div className="space-y-2">
            <div className="h-10 w-full animate-pulse rounded-md bg-primary/15" />
            <div className="h-10 w-full animate-pulse rounded-md bg-primary/15" />
          </div>
          <div className="flex justify-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-accent/20" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-accent/20" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-md" style={{ backgroundColor: data.primaryColor || '#4F46E5' }} />
        </div>
      </LoginLayoutRenderer>
    </div>
  )
}
