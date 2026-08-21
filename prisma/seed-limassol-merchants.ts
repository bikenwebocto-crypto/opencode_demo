import { PrismaClient, MerchantStatus, MerchantOnboardingStep, BranchType, BranchStatus } from "@prisma/client";

const MERCHANT_ASSET_BASE_URL = process.env.MERCHANT_ASSET_BASE_URL ?? "https://assets.perksandmore.com";

// categorySlug must already exist in your `categories` table (global master data).
type SeedMerchant = {
  businessName: string;
  slug: string;
  contactName: string;
  contactPhone: string;
  description: string;
  website?: string;
  categorySlug: "fashion" | "shopping-malls" | "family-kids" | "home-improvement" | "toys-games";
  tags: string[];
  branch: {
    name: string;
    addressLine1: string;
    city: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
    phone: string;
  };
};

export const limassolMerchants: SeedMerchant[] = [
  {
    businessName: "Timinis Outlet",
    slug: "timinis-outlet-limassol",
    contactName: "Timinis Outlet Management",
    contactPhone: "+357 25 335066",
    description: "Fashion outlet on Makarios Avenue offering discounted clothing, shoes and accessories.",
    website: "https://www.timinis.com/",
    categorySlug: "fashion",
    tags: ["fashion", "outlet", "clothing"],
    branch: {
      name: "Timinis Outlet – Makarios Avenue",
      addressLine1: "Arch. Makarios III Avenue 125-127",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "3021",
      latitude: 34.68553,
      longitude: 33.0328402,
      phone: "+357 25 335066",
    },
  },
  {
    businessName: "MY MALL Limassol",
    slug: "my-mall-limassol",
    contactName: "MY MALL Limassol Management",
    contactPhone: "+357 25 343777",
    description: "Large shopping mall with a wide mix of international and local fashion, dining and lifestyle stores.",
    website: "http://www.mymall.com.cy/",
    categorySlug: "shopping-malls",
    tags: ["mall", "shopping-center", "family"],
    branch: {
      name: "MY MALL Limassol",
      addressLine1: "285 Franklin Roosevelt",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "3150",
      latitude: 34.6527985,
      longitude: 32.9971829,
      phone: "+357 25 343777",
    },
  },
  {
    businessName: "Hyper Fashion Boutique",
    slug: "hyper-fashion-boutique-limassol",
    contactName: "Hyper Fashion Boutique Management",
    contactPhone: "+357 25 738830",
    description: "Multi-brand fashion boutique carrying clothing, shoes and accessories.",
    website: "https://eshop.hypercy.com/",
    categorySlug: "fashion",
    tags: ["fashion", "boutique", "clothing"],
    branch: {
      name: "Hyper Fashion Boutique – Makarios Avenue",
      addressLine1: "Arch. Makarios III Avenue 137",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "3021",
      latitude: 34.6863557,
      longitude: 33.0345639,
      phone: "+357 25 738830",
    },
  },
  {
    businessName: "Luxury Brands Outlet",
    slug: "luxury-brands-outlet",
    contactName: "Luxury Brands Outlet Management",
    contactPhone: "+357 25 349988",
    description: "Outlet specializing in discounted luxury clothing, shoes and leather goods.",
    website: "https://luxurybrandscy.com/",
    categorySlug: "fashion",
    tags: ["fashion", "luxury", "outlet"],
    branch: {
      name: "Luxury Brands Outlet – Spyrou Kyprianou",
      addressLine1: "Spyrou Kyprianou Ave 60",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "4154",
      latitude: 34.6816855,
      longitude: 33.0118312,
      phone: "+357 25 349988",
    },
  },
  {
    businessName: "Little Family Project",
    slug: "little-family-project",
    contactName: "Little Family Project Management",
    contactPhone: "+357 25 252581",
    description: "Curated kids' clothing, toys, and home goods for the whole family.",
    website: "https://www.littlefamilyproject.com/",
    categorySlug: "family-kids",
    tags: ["kids", "family", "clothing", "toys"],
    branch: {
      name: "Little Family Project – Gladstonos",
      addressLine1: "Gladstonos 82",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "3040",
      latitude: 34.6808498,
      longitude: 33.0443255,
      phone: "+357 25 252581",
    },
  },
  {
    businessName: "Mangas Home Improvement",
    slug: "mangas-home-improvement",
    contactName: "Mangas Home Improvement Management",
    contactPhone: "+357 25 828000",
    description: "Home improvement, DIY, garden and sporting goods store.",
    website: "http://www.mangas.com.cy/",
    categorySlug: "home-improvement",
    tags: ["home-improvement", "diy", "garden"],
    branch: {
      name: "Mangas Home Improvement – Agios Athanasios",
      addressLine1: "Andrea Kariolou, Agios Athanasios",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "4102",
      latitude: 34.7029238,
      longitude: 33.0657137,
      phone: "+357 25 828000",
    },
  },
  {
    businessName: "Mitsingas Wonderland",
    slug: "mitsingas-wonderland",
    contactName: "Mitsingas Wonderland Management",
    contactPhone: "+357 25 820888",
    description: "Toy store with a wide selection of board games, LEGO, action figures and puzzles.",
    website: "https://www.mitsingaswonderlandtoys.com/",
    categorySlug: "toys-games",
    tags: ["toys", "games", "lego"],
    branch: {
      name: "Mitsingas Wonderland – Makarios Avenue",
      addressLine1: "Arch. Makarios III Avenue 185",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "3030",
      latitude: 34.6876813,
      longitude: 33.0469878,
      phone: "+357 25 820888",
    },
  },
  {
    businessName: "Limassol Shopping Center",
    slug: "limassol-shopping-center",
    contactName: "Limassol Shopping Center Management",
    contactPhone: "+357 96 323212",
    description: "Shopping center anchored by IKEA and a large supermarket, plus sports, jewelry and coffee shops.",
    categorySlug: "shopping-malls",
    tags: ["mall", "shopping-center", "ikea"],
    branch: {
      name: "Limassol Shopping Center – Kato Polemidia",
      addressLine1: "Theodorou Potamianou 42, Kato Polemidia",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "4154",
      latitude: 34.6880747,
      longitude: 33.0107852,
      phone: "+357 96 323212",
    },
  },
  {
    businessName: "Limassol Shopping Centre",
    slug: "limassol-shopping-centre-katsantonaion",
    contactName: "Limassol Shopping Centre Management",
    contactPhone: "+357 25 333375",
    description: "Shopping centre with AlphaMega supermarket, Jumbo, IKEA and Sport Direct.",
    categorySlug: "shopping-malls",
    tags: ["mall", "shopping-center", "supermarket"],
    branch: {
      name: "Limassol Shopping Centre – Katsantonaion",
      addressLine1: "Katsantonaion 20",
      city: "Limassol",
      country: "Cyprus",
      postalCode: "4154",
      latitude: 34.6874191,
      longitude: 33.0101126,
      phone: "+357 25 333375",
    },
  },
];

export async function seedLimassolMerchants(prisma: PrismaClient) {
  for (const m of limassolMerchants) {
    const category = await prisma.category.findUnique({ where: { slug: m.categorySlug } });

    const merchant = await prisma.merchant.upsert({
      where: { slug: m.slug },
      update: {},
      create: {
        businessName: m.businessName,
        slug: m.slug,
        contactName: m.contactName,
        contactPhone: m.contactPhone,
        description: m.description,
        website: m.website,
        logoUrl: `${MERCHANT_ASSET_BASE_URL}/logos/${m.slug}.png`,
        coverImageUrl: `${MERCHANT_ASSET_BASE_URL}/covers/${m.slug}.png`,
        categoryId: category?.id,
        status: MerchantStatus.ACTIVE,
        onboardingStep: MerchantOnboardingStep.COMPLETE,
        addressLine1: m.branch.addressLine1,
        city: m.branch.city,
        country: m.branch.country,
        postalCode: m.branch.postalCode,
        tags: m.tags,
        approvedAt: new Date(),
        liveAt: new Date(),
      },
    });

    const existingBranch = await prisma.merchantBranch.findFirst({
      where: { merchantId: merchant.id, isPrimary: true },
    });

    if (!existingBranch) {
      await prisma.merchantBranch.create({
        data: {
          merchantId: merchant.id,
          name: m.branch.name,
          addressLine1: m.branch.addressLine1,
          city: m.branch.city,
          country: m.branch.country,
          postalCode: m.branch.postalCode,
          phone: m.branch.phone,
          latitude: m.branch.latitude,
          longitude: m.branch.longitude,
          branchType: BranchType.IN_STORE,
          status: BranchStatus.ACTIVE,
          isPrimary: true,
          isActive: true,
        },
      });
    }

    console.log(`Seeded merchant: ${merchant.businessName} (${merchant.slug})`);
  }
}
