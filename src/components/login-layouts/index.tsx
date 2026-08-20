import type { ReactNode } from 'react'
import { SplitCardLayout } from './split-card-layout'
import { CenterCardLayout } from './center-card-layout'
import { FullscreenHeroLayout } from './fullscreen-hero-layout'
import { resolveLayout } from './branding-helpers'
import type { LayoutBranding } from './split-card-layout'

export type { LayoutBranding } from './split-card-layout'

interface LoginLayoutRendererProps {
  branding: LayoutBranding & { layout?: string }
  children: ReactNode
  compact?: boolean
}

export function LoginLayoutRenderer({ branding, children, compact }: LoginLayoutRendererProps) {
  const layout = resolveLayout(branding.layout ?? 'SPLIT_CARD')

  switch (layout) {
    case 'CENTER_CARD':
      return <CenterCardLayout branding={branding} compact={compact}>{children}</CenterCardLayout>
    case 'FULLSCREEN_HERO':
      return <FullscreenHeroLayout branding={branding} compact={compact}>{children}</FullscreenHeroLayout>
    default:
      return <SplitCardLayout branding={branding} compact={compact}>{children}</SplitCardLayout>
  }
}
