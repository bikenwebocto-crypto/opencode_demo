-- CreateTable
CREATE TABLE "Theme" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Theme_slug_key" ON "Theme"("slug");

-- InsertDefaultTheme
INSERT INTO "Theme" ("name", "slug", "isActive", "settings") VALUES
('Default', 'default', true, '{
  "sidebarBg": "0 0% 100%",
  "sidebarBgOpacity": 1,
  "sidebarText": "222.2 84% 4.9%",
  "sidebarTextMuted": "215.4 16.3% 46.9%",
  "sidebarActiveBg": "221.2 83.2% 53.3%",
  "sidebarActiveText": "221.2 83.2% 53.3%",
  "sidebarHoverBg": "210 40% 96.1%",
  "sidebarHoverText": "222.2 84% 4.9%",
  "sidebarBorder": "214.3 31.8% 91.4%",
  "sidebarBadgeBg": "221.2 83.2% 53.3%",
  "sidebarBadgeText": "210 40% 98%",
  "navbarBg": "0 0% 100%",
  "navbarBgOpacity": 1,
  "navbarText": "222.2 84% 4.9%",
  "navbarBorder": "214.3 31.8% 91.4%",
  "navbarDropdownBg": "0 0% 100%",
  "liveIndicatorBg": "142 76% 94%",
  "liveIndicatorText": "142 72% 29%",
  "liveDotColor": "142 71% 45%",
  "overlayBg": "0 0% 0%"
}'),
('Dark', 'dark', false, '{
  "sidebarBg": "222.2 84% 4.9%",
  "sidebarBgOpacity": 1,
  "sidebarText": "210 40% 98%",
  "sidebarTextMuted": "215 20.2% 65.1%",
  "sidebarActiveBg": "217.2 91.2% 59.8%",
  "sidebarActiveText": "217.2 91.2% 59.8%",
  "sidebarHoverBg": "217.2 32.6% 17.5%",
  "sidebarHoverText": "210 40% 98%",
  "sidebarBorder": "217.2 32.6% 17.5%",
  "sidebarBadgeBg": "217.2 91.2% 59.8%",
  "sidebarBadgeText": "222.2 47.4% 11.2%",
  "navbarBg": "222.2 84% 4.9%",
  "navbarBgOpacity": 1,
  "navbarText": "210 40% 98%",
  "navbarBorder": "217.2 32.6% 17.5%",
  "navbarDropdownBg": "222.2 84% 4.9%",
  "liveIndicatorBg": "142 70% 45%",
  "liveIndicatorText": "142 76% 94%",
  "liveDotColor": "142 71% 45%",
  "overlayBg": "0 0% 0%"
}');
