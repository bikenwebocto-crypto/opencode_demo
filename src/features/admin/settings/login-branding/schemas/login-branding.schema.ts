export interface LoginBrandingData {
  appName?: string | null;
  tagline?: string | null;
  heading?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  backgroundImageUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  cardBackground?: string | null;
  layout?: string;
  showLogo?: boolean;
  showHeading?: boolean;
  showDescription?: boolean;
  showBanner?: boolean;
  showFooter?: boolean;
  footerTitle?: string | null;
  footerDescription?: string | null;
  copyright?: string | null;
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_LENGTHS: Record<string, number> = {
  appName: 100,
  tagline: 200,
  heading: 200,
  description: 500,
  footerTitle: 200,
  footerDescription: 500,
  copyright: 300,
};

export function validateLoginBranding(
  data: Record<string, unknown>,
): string | null {
  console.log("Validating login branding data:", data);
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || value === "") continue;

    if (
      key.endsWith("Color") ||
      key === "primaryColor" ||
      key === "secondaryColor" ||
      key === "accentColor" ||
      key === "textColor" ||
      key === "cardBackground"
    ) {
      if (typeof value !== "string" || !HEX_COLOR.test(value)) {
        return `${key} must be a valid hex color (e.g. #FF0000)`;
      }
    }

    if (key.endsWith("Url") && typeof value === "string" && value.length > 0) {
      try {
        new URL(value);
      } catch {
        return `${key} must be a valid URL`;
      }
    }
    if (typeof value === "string") {
      const maxLen = MAX_LENGTHS[key as keyof typeof MAX_LENGTHS];

      if (maxLen !== undefined && value.length > maxLen) {
        return `${key} must be at most ${maxLen} characters`;
      }
    }
  }

  return null;
}
