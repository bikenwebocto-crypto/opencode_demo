import type { ReactNode } from 'react'
import { BrandingContent } from './branding-content'
import { extractColors } from './branding-helpers'
import type { LayoutBranding } from './split-card-layout'

interface CenterCardLayoutProps {
  branding: LayoutBranding
  children: ReactNode
  compact?: boolean
}

export function CenterCardLayout({ branding, children, compact }: CenterCardLayoutProps) {
  const colors = extractColors(branding)

  return (
    <div
      className={compact ? 'flex items-center justify-center p-4' : 'flex min-h-screen items-center justify-center p-4'}
      style={{
        backgroundColor: `${colors.primary}08`,
        ...(branding.backgroundImageUrl
          ? { backgroundImage: `url(${branding.backgroundImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : {}),
      }}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <div
          className="mb-6 flex w-full flex-col items-center rounded-2xl p-6 text-center shadow-lg backdrop-blur-sm"
          style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.primary}15`,
          }}
        >
          <BrandingContent
            appName={branding.appName ?? null}
            tagline={branding.tagline ?? null}
            heading={branding.heading ?? null}
            description={branding.description ?? null}
            logoUrl={branding.logoUrl ?? null}
            bannerUrl={branding.bannerUrl ?? null}
            primaryColor={colors.primary}
            textColor={colors.text}
            cardBackground={colors.cardBg}
            showLogo={branding.showLogo ?? true}
            showHeading={branding.showHeading ?? true}
            showDescription={branding.showDescription ?? true}
            showBanner={branding.showBanner ?? true}
            showFooter={branding.showFooter ?? true}
            footerTitle={branding.footerTitle ?? null}
            footerDescription={branding.footerDescription ?? null}
            copyright={branding.copyright ?? null}
          />
        </div>

        <div
          className="w-full rounded-2xl p-6 shadow-lg backdrop-blur-sm"
          style={{
            backgroundColor: colors.cardBg,
            border: `1px solid ${colors.primary}15`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
