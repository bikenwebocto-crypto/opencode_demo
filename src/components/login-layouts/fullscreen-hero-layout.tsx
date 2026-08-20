import type { ReactNode } from 'react'
import { BrandingContent } from './branding-content'
import { extractColors } from './branding-helpers'
import type { LayoutBranding } from './split-card-layout'

interface FullscreenHeroLayoutProps {
  branding: LayoutBranding
  children: ReactNode
  compact?: boolean
}

export function FullscreenHeroLayout({ branding, children, compact }: FullscreenHeroLayoutProps) {
  const colors = extractColors(branding)
  const heroUrl = branding.backgroundImageUrl || branding.bannerUrl

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${compact ? 'p-4' : 'min-h-screen'}`}
      style={{
        backgroundColor: colors.primary,
        ...(heroUrl ? { backgroundImage: `url(${heroUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/30" />

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center gap-6 px-4 md:flex-row md:items-start md:px-8">
        <div className="flex flex-1 flex-col items-center justify-center pt-4 text-center md:pt-8">
          <BrandingContent
            appName={branding.appName ?? null}
            tagline={branding.tagline ?? null}
            heading={branding.heading ?? null}
            description={branding.description ?? null}
            logoUrl={branding.logoUrl ?? null}
            bannerUrl={null}
            primaryColor="#ffffff"
            textColor="#ffffff"
            cardBackground="transparent"
            showLogo={branding.showLogo ?? true}
            showHeading={branding.showHeading ?? true}
            showDescription={branding.showDescription ?? true}
            showBanner={false}
            showFooter={branding.showFooter ?? true}
            footerTitle={branding.footerTitle ?? null}
            footerDescription={branding.footerDescription ?? null}
            copyright={branding.copyright ?? null}
          />
        </div>

        <div
          className="w-full max-w-md rounded-2xl p-6 shadow-2xl backdrop-blur-xl"
          style={{
            backgroundColor: `${colors.cardBg}cc`,
            border: `1px solid rgba(255,255,255,0.2)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
