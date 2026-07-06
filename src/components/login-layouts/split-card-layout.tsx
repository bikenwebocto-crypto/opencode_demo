import type { ReactNode } from 'react'
import { BrandingContent } from './branding-content'
import { extractColors } from './branding-helpers'

export interface LayoutBranding {
  appName?: string | null
  tagline?: string | null
  heading?: string | null
  description?: string | null
  logoUrl?: string | null
  bannerUrl?: string | null
  backgroundImageUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  textColor?: string | null
  cardBackground?: string | null
  showLogo?: boolean
  showHeading?: boolean
  showDescription?: boolean
  showBanner?: boolean
  showFooter?: boolean
  footerTitle?: string | null
  footerDescription?: string | null
  copyright?: string | null
}

interface SplitCardLayoutProps {
  branding: LayoutBranding
  children: ReactNode
  compact?: boolean
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '')
  if (clean.length !== 6 && clean.length !== 3) return null
  const full = clean.length === 3 ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2] : clean
  const num = parseInt(full, 16)
  if (isNaN(num)) return null
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function darken(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const r = Math.max(0, Math.round(rgb.r * (1 - amount)))
  const g = Math.max(0, Math.round(rgb.g * (1 - amount)))
  const b = Math.max(0, Math.round(rgb.b * (1 - amount)))
  return `rgb(${r},${g},${b})`
}

export function SplitCardLayout({ branding, children, compact }: SplitCardLayoutProps) {
  const colors = extractColors(branding)
  const { backgroundImageUrl, tagline, appName } = branding

  return (
    <div
      className="relative flex min-h-screen w-full flex-col overflow-auto md:flex-row md:overflow-hidden"
      style={{
        backgroundColor: colors.cardBg,
        ...(backgroundImageUrl
          ? {
              backgroundImage: `url(${backgroundImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {}),
      }}
    >
      {/* LEFT PANEL */}
      <div
        className="relative flex w-full items-center justify-center overflow-hidden px-6 py-12 md:w-[60%] md:justify-start md:pl-[8%]"
        style={{
          background: `linear-gradient(135deg, ${colors.secondary} 0%, ${darken(colors.secondary, 0.15)} 100%)`,
        }}
      >
        {/* Background stripes */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              'linear-gradient(30deg, transparent 40%, rgba(255,255,255,.03) 41%, rgba(255,255,255,.03) 45%, transparent 46%)',
            backgroundSize: '30px 30px',
          }}
        />

        {/* Diagonal divider — hidden on mobile */}
        <div
          className="absolute right-[-100px] top-0 hidden h-full w-[200px] md:block"
          style={{
            background: darken(colors.cardBg, 0),
            transform: 'skewX(-10deg)',
            boxShadow: `-15px 0 50px rgba(0,0,0,.8)`,
          }}
        />

        <div className="relative z-10 w-full max-w-lg text-center md:text-left">
          <span
            className="mb-3 block text-sm tracking-[4px]"
            style={{
              color: colors.primary,
              textShadow: `0 0 12px ${colors.primary}`,
            }}
          >
            * {tagline?.toUpperCase() || `${(appName || 'PLATFORM').toUpperCase()} READY`} *
          </span>

          <BrandingContent
            appName={branding.appName ?? null}
            tagline={branding.tagline ?? null}
            heading={branding.heading ?? null}
            description={branding.description ?? null}
            logoUrl={branding.logoUrl ?? null}
            bannerUrl={branding.bannerUrl ?? null}
            primaryColor={colors.primary}
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
      </div>

      {/* RIGHT PANEL */}
      <div
        className="flex w-full items-center justify-center px-6 py-12 md:w-[40%] md:px-10"
        style={{ backgroundColor: colors.cardBg }}
      >
        <div className="w-full max-w-md">
          <span className="text-xs tracking-[3px]" style={{ color: `${colors.text}80` }}>
            {appName?.toUpperCase() || 'PLATFORM'} ACCESS
          </span>

          <h2
            className="mb-6 mt-2 text-3xl font-bold md:mb-10 md:text-4xl"
            style={{ color: colors.text }}
          >
            {branding.heading || 'SIGN IN'}
          </h2>

          {children}
        </div>
      </div>
    </div>
  )
}
