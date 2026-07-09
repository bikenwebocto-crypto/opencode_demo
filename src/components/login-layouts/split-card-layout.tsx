import type { ReactNode } from 'react'
import Image from 'next/image'
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
  const full = clean.length === 3 ? clean.charAt(0) + clean.charAt(0) + clean.charAt(1) + clean.charAt(1) + clean.charAt(2) + clean.charAt(2) : clean
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
  const { backgroundImageUrl, appName, logoUrl, bannerUrl, tagline, footerTitle, footerDescription } = branding

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#eef1fb] p-10">
      <div className="relative w-full max-w-[1450px] rounded-[34px] bg-white p-5 shadow-[0_25px_70px_rgba(0,0,0,.12)]">
        <div
          className="relative overflow-hidden rounded-[28px]"
          style={{
            backgroundColor: colors.secondary,
            minHeight: compact ? 'auto' : '760px',
          }}
        >
          {!compact && (
            <>
              <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 select-none rounded-full bg-indigo-500/10 blur-3xl" />
              <div className="pointer-events-none absolute right-10 top-0 h-80 w-80 select-none rounded-full bg-purple-300/10 blur-3xl" />
              <div
                className="pointer-events-none absolute inset-0 select-none opacity-10"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                }}
              />
            </>
          )}

          {backgroundImageUrl && (
            <img
              src={backgroundImageUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-10"
            />
          )}

          {/* Navigation */}
          <header className={`relative z-10 flex items-center justify-between ${compact ? 'px-6 py-4' : 'px-14 py-10'}`}>
            <div className="flex items-center gap-3">
              {branding.showLogo !== false && logoUrl && (
                <img src={logoUrl} alt={`${appName || ''} logo`} className="h-10 object-contain" />
              )}
              {appName && <span className="text-lg font-semibold text-white">{appName}</span>}
            </div>
            {!compact && (
              <nav className="flex items-center gap-8 text-sm text-white/70">
                <a className="cursor-pointer transition-colors hover:text-white">Marketplace</a>
                <a className="cursor-pointer transition-colors hover:text-white">Drops</a>
                <a className="cursor-pointer transition-colors hover:text-white">Brands</a>
                <a className="cursor-pointer transition-colors hover:text-white">Contact</a>
                <button className="cursor-pointer transition-colors hover:text-white">Login</button>
                <button
                  className="cursor-pointer rounded-full px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: colors.primary }}
                >
                  Sign Up
                </button>
              </nav>
            )}
          </header>

          {/* Hero grid */}
          <div className={`relative z-10 ${compact ? 'px-6 pb-8' : 'grid grid-cols-[65%_35%] px-16'}`}>
            {/* Left: Banner */}
            {!compact && (
              <div className="relative h-[500px]">
                {branding.showBanner !== false && bannerUrl ? (
                  <Image src={bannerUrl} fill className="object-contain" alt="Illustration" />
                ) : (
                  <div className="flex h-full items-center">
                    <div>
                      {tagline && (
                        <span className="block text-sm tracking-[4px] text-white/60">
                          * {tagline.toUpperCase()} *
                        </span>
                      )}
                      {branding.showHeading !== false && (
                        <h1 className="mt-2 text-4xl font-bold text-white">
                          {branding.heading || 'Welcome Back'}
                        </h1>
                      )}
                      {branding.showDescription !== false && (
                        <p className="mt-3 max-w-md text-base text-white/70">
                          {branding.description || 'Sign in to continue to your dashboard.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Right: Login card */}
            <div className={`flex ${compact ? 'w-full' : 'justify-center'}`}>
              <div
                className={`rounded-[24px] bg-white shadow-xl ${
                  compact ? 'w-full p-6' : 'w-[390px] p-10 mt-[120px]'
                }`}
              >
                <span className="text-xs uppercase tracking-[4px] text-slate-400">
                  {appName ? `${appName.toUpperCase()} ACCESS` : 'PLATFORM ACCESS'}
                </span>
                <h1 className={`mt-3 font-bold text-gray-900 ${compact ? 'text-2xl' : 'text-4xl'}`}>
                  {branding.heading || 'Welcome Back'}
                </h1>
                <p className={`mt-2 text-slate-500 ${compact ? 'mb-4 text-xs' : 'mb-8 text-sm'}`}>
                  {branding.description || 'Sign in to continue'}
                </p>
                {children}
              </div>
            </div>
          </div>

          {/* Mobile heading + description */}
          {compact && (
            <div className="relative z-10 px-6 pb-6">
              {tagline && (
                <span className="block text-sm tracking-[4px] text-white/60">
                  * {tagline.toUpperCase()} *
                </span>
              )}
              {branding.showHeading !== false && (
                <h1 className="mt-2 text-2xl font-bold text-white">
                  {branding.heading || 'Welcome Back'}
                </h1>
              )}
              {branding.showDescription !== false && (
                <p className="mt-2 max-w-md text-sm text-white/70">
                  {branding.description || 'Sign in to continue to your dashboard.'}
                </p>
              )}
            </div>
          )}

          {/* Curved bottom */}
          {!compact && (
            <div className="absolute bottom-0 left-0 h-[120px] w-[65%] rounded-tr-[120px] bg-white" />
          )}

          {/* Footer links */}
          {!compact && (
            <footer className="absolute bottom-8 left-[45%] z-10 flex gap-10 text-sm text-white/70">
              <a className="cursor-pointer transition-colors hover:text-white">Twitter</a>
              <a className="cursor-pointer transition-colors hover:text-white">Instagram</a>
              <a className="cursor-pointer transition-colors hover:text-white">Privacy</a>
            </footer>
          )}
        </div>

        {/* Floating testimonial */}
        {!compact && branding.showFooter !== false && (footerTitle || footerDescription || logoUrl) && (
          <div className="absolute bottom-0 left-14 flex w-[420px] translate-y-1/2 items-center gap-5 rounded-full bg-white px-8 py-5 shadow-2xl">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-14 w-80 flex-shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-300 text-lg font-bold text-slate-600">
                {(footerTitle || appName || '?')[0]}
              </div>
            )}
            <div>
              {footerTitle && <p className="font-semibold text-gray-900">{footerTitle}</p>}
              {footerDescription && <p className="text-sm text-slate-500">{footerDescription}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
