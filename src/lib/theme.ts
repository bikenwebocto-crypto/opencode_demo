import { prisma } from '@/lib/prisma'
import { safeQuery } from '@/lib/prisma/safe-query'

export interface ThemeSettings {
  sidebarBg: string
  sidebarBgOpacity: number
  sidebarText: string
  sidebarTextMuted: string
  sidebarActiveBg: string
  sidebarActiveText: string
  sidebarHoverBg: string
  sidebarHoverText: string
  sidebarBorder: string
  sidebarBadgeBg: string
  sidebarBadgeText: string
  navbarBg: string
  navbarBgOpacity: number
  navbarText: string
  navbarBorder: string
  navbarDropdownBg: string
  liveIndicatorBg: string
  liveIndicatorText: string
  liveDotColor: string
  overlayBg: string
}

const DEFAULT_SETTINGS: ThemeSettings = {
  sidebarBg: '0 0% 100%',
  sidebarBgOpacity: 1,
  sidebarText: '222.2 84% 4.9%',
  sidebarTextMuted: '215.4 16.3% 46.9%',
  sidebarActiveBg: '221.2 83.2% 53.3%',
  sidebarActiveText: '221.2 83.2% 53.3%',
  sidebarHoverBg: '210 40% 96.1%',
  sidebarHoverText: '222.2 84% 4.9%',
  sidebarBorder: '214.3 31.8% 91.4%',
  sidebarBadgeBg: '221.2 83.2% 53.3%',
  sidebarBadgeText: '210 40% 98%',
  navbarBg: '0 0% 100%',
  navbarBgOpacity: 1,
  navbarText: '222.2 84% 4.9%',
  navbarBorder: '214.3 31.8% 91.4%',
  navbarDropdownBg: '0 0% 100%',
  liveIndicatorBg: '142 76% 94%',
  liveIndicatorText: '142 72% 29%',
  liveDotColor: '142 71% 45%',
  overlayBg: '0 0% 0%',
}

const DARK_SETTINGS: ThemeSettings = {
  sidebarBg: '222.2 84% 4.9%',
  sidebarBgOpacity: 1,
  sidebarText: '210 40% 98%',
  sidebarTextMuted: '215 20.2% 65.1%',
  sidebarActiveBg: '217.2 91.2% 59.8%',
  sidebarActiveText: '217.2 91.2% 59.8%',
  sidebarHoverBg: '217.2 32.6% 17.5%',
  sidebarHoverText: '210 40% 98%',
  sidebarBorder: '217.2 32.6% 17.5%',
  sidebarBadgeBg: '217.2 91.2% 59.8%',
  sidebarBadgeText: '222.2 47.4% 11.2%',
  navbarBg: '222.2 84% 4.9%',
  navbarBgOpacity: 1,
  navbarText: '210 40% 98%',
  navbarBorder: '217.2 32.6% 17.5%',
  navbarDropdownBg: '222.2 84% 4.9%',
  liveIndicatorBg: '142 70% 45%',
  liveIndicatorText: '142 76% 94%',
  liveDotColor: '142 71% 45%',
  overlayBg: '0 0% 0%',
}

let cachedTheme: { slug: string; settings: ThemeSettings } | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60_000

async function ensureDefaultThemesExist(): Promise<void> {
  const count = await prisma.theme.count()
  if (count > 0) return

  await prisma.$transaction([
    prisma.theme.create({
      data: { name: 'Default', slug: 'default', isActive: true, settings: DEFAULT_SETTINGS as any },
    }),
    prisma.theme.create({
      data: { name: 'Dark', slug: 'dark', isActive: false, settings: DARK_SETTINGS as any },
    }),
  ])
}

async function ensureThemeExists(slug: string): Promise<void> {
  const exists = await prisma.theme.findUnique({ where: { slug }, select: { id: true } })
  if (exists) return

  const settingsMap: Record<string, ThemeSettings> = {
    default: DEFAULT_SETTINGS,
    dark: DARK_SETTINGS,
  }
  const settings = settingsMap[slug] ?? DEFAULT_SETTINGS
  const nameMap: Record<string, string> = { default: 'Default', dark: 'Dark' }

  await prisma.theme.create({
    data: {
      name: nameMap[slug] ?? slug,
      slug,
      isActive: slug === 'default',
      settings: settings as any,
    },
  })
}

export async function getActiveTheme(): Promise<ThemeSettings> {
  const now = Date.now()
  if (cachedTheme && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedTheme.settings
  }

  return safeQuery(
    async () => {
      await ensureDefaultThemesExist()
      const theme = await prisma.theme.findFirst({ where: { isActive: true } })
      if (!theme) return DEFAULT_SETTINGS
      const settings = theme.settings as unknown as ThemeSettings
      cachedTheme = { slug: theme.slug, settings }
      cacheTimestamp = now
      return settings
    },
    DEFAULT_SETTINGS,
    { context: 'Theme.getActiveTheme' },
  )
}

export function invalidateThemeCache(): void {
  cachedTheme = null
  cacheTimestamp = 0
}

export async function getAllThemes() {
  return safeQuery(
    async () => {
      await ensureDefaultThemesExist()
      return prisma.theme.findMany({ orderBy: { createdAt: 'desc' } })
    },
    [],
    { context: 'Theme.findMany:getAllThemes' },
  )
}

export async function getThemeBySlug(slug: string) {
  return safeQuery(
    async () => {
      await ensureThemeExists(slug)
      return prisma.theme.findUnique({ where: { slug } })
    },
    null,
    { context: 'Theme.findUnique:getThemeBySlug' },
  )
}

export async function updateThemeSettings(slug: string, settings: Partial<ThemeSettings>) {
  await ensureThemeExists(slug)
  const theme = await prisma.theme.findUnique({ where: { slug } })
  if (!theme) throw new Error('Theme not found')
  const currentSettings = theme.settings as Record<string, unknown>
  const newSettings = { ...currentSettings, ...settings }
  const updated = await prisma.theme.update({
    where: { slug },
    data: { settings: newSettings },
  })
  invalidateThemeCache()
  return updated
}

export async function activateTheme(slug: string) {
  await ensureThemeExists(slug)
  await prisma.$transaction([
    prisma.theme.updateMany({ data: { isActive: false } }),
    prisma.theme.update({ where: { slug }, data: { isActive: true } }),
  ])
  invalidateThemeCache()
}

export function generateThemeCssVars(settings: ThemeSettings): string {
  return `
    --sidebar-bg: ${settings.sidebarBg};
    --sidebar-bg-opacity: ${settings.sidebarBgOpacity};
    --sidebar-text: ${settings.sidebarText};
    --sidebar-text-muted: ${settings.sidebarTextMuted};
    --sidebar-active-bg: ${settings.sidebarActiveBg};
    --sidebar-active-text: ${settings.sidebarActiveText};
    --sidebar-hover-bg: ${settings.sidebarHoverBg};
    --sidebar-hover-text: ${settings.sidebarHoverText};
    --sidebar-border: ${settings.sidebarBorder};
    --sidebar-badge-bg: ${settings.sidebarBadgeBg};
    --sidebar-badge-text: ${settings.sidebarBadgeText};
    --navbar-bg: ${settings.navbarBg};
    --navbar-bg-opacity: ${settings.navbarBgOpacity};
    --navbar-text: ${settings.navbarText};
    --navbar-border: ${settings.navbarBorder};
    --navbar-dropdown-bg: ${settings.navbarDropdownBg};
    --live-indicator-bg: ${settings.liveIndicatorBg};
    --live-indicator-text: ${settings.liveIndicatorText};
    --live-dot-color: ${settings.liveDotColor};
    --overlay-bg: ${settings.overlayBg};
  `.trim()
}
