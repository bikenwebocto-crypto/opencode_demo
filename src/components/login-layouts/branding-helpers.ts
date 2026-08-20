export type BrandingColors = {
  primary: string
  secondary: string
  accent: string
  text: string
  cardBg: string
}

export function extractColors(branding: {
  primaryColor?: string | null
  secondaryColor?: string | null
  accentColor?: string | null
  textColor?: string | null
  cardBackground?: string | null
}): BrandingColors {
  return {
    primary: branding.primaryColor || '#4F46E5',
    secondary: branding.secondaryColor || '#7C3AED',
    accent: branding.accentColor || '#06B6D4',
    text: branding.textColor || '#1E293B',
    cardBg: branding.cardBackground || '#ffffff',
  }
}

export function resolveLayout(layout: string): string {
  if (layout === 'SPLIT') return 'SPLIT_CARD'
  return layout
}

export const LAYOUT_NAMES: Record<string, string> = {
  SPLIT_CARD: 'Split Card',
  CENTER_CARD: 'Center Card',
  FULLSCREEN_HERO: 'Fullscreen Hero',
}
