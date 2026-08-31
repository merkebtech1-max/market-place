import type { Category } from "@/features/catalog/types";
import type { Listing, ListingSeller } from "@/features/listings/types";

/**
 * Placeholder catalogue + listings so every screen renders real-looking
 * content before the `catalog`/`listings`/`search` API modules (SRS §8.1)
 * exist. Swap `getListings`/`getListingById` for `GET /listings` calls
 * once the backend is live — callers already treat these as async.
 */

export const categories: Category[] = [
  { id: "cat-phones", slug: "phones-tablets", nameEn: "Phones & Tablets", nameAm: "ስልክ እና ታብሌት", icon: "📱", listingCount: 1240 },
  { id: "cat-electronics", slug: "electronics", nameEn: "Electronics", nameAm: "ኤሌክትሮኒክስ", icon: "🖥️", listingCount: 860 },
  { id: "cat-vehicles", slug: "vehicles", nameEn: "Vehicles", nameAm: "ተሽከርካሪዎች", icon: "🚗", listingCount: 410 },
  { id: "cat-furniture", slug: "furniture", nameEn: "Furniture", nameAm: "የቤት ዕቃ", icon: "🛋️", listingCount: 690 },
  { id: "cat-fashion", slug: "fashion", nameEn: "Fashion", nameAm: "ልብስ እና ጫማ", icon: "👗", listingCount: 1530 },
  { id: "cat-home", slug: "home-garden", nameEn: "Home & Garden", nameAm: "ቤት እና ግቢ", icon: "🪴", listingCount: 320 },
  { id: "cat-kids", slug: "kids-baby", nameEn: "Kids & Baby", nameAm: "ልጆች እና ህጻናት", icon: "🧸", listingCount: 275 },
  { id: "cat-hobbies", slug: "books-hobbies", nameEn: "Books & Hobbies", nameAm: "መጻሕፍት እና ትርፍ ጊዜ", icon: "📚", listingCount: 190 },
  { id: "cat-services", slug: "services", nameEn: "Services", nameAm: "አገልግሎቶች", icon: "🛠️", listingCount: 150 },
];

const sellers: ListingSeller[] = [
  {
    id: "seller-1",
    handle: "biniam-t",
    displayName: "Biniam T.",
    avatarUrl: "https://i.pravatar.cc/120?img=12",
    city: "Addis Ababa",
    subcity: "Bole",
    ratingAvg: 4.8,
    ratingCount: 63,
    responseRate: 96,
    responseTime: "within an hour",
    memberSince: "2024-03-01",
    isVerified: true,
    isPremium: true,
  },
  {
    id: "seller-2",
    handle: "selam-g",
    displayName: "Selam G.",
    avatarUrl: "https://i.pravatar.cc/120?img=32",
    city: "Addis Ababa",
    subcity: "Yeka",
    ratingAvg: 4.6,
    ratingCount: 28,
    responseRate: 88,
    responseTime: "within a few hours",
    memberSince: "2025-01-14",
    isVerified: true,
  },
  {
    id: "seller-3",
    handle: "yosef-m",
    displayName: "Yosef M.",
    city: "Adama",
    subcity: "Adama Ketema",
    ratingAvg: 4.2,
    ratingCount: 11,
    responseRate: 71,
    responseTime: "within a day",
    memberSince: "2025-06-20",
  },
  {
    id: "seller-4",
    handle: "hanna-store",
    displayName: "Hanna's Closet",
    avatarUrl: "https://i.pravatar.cc/120?img=47",
    city: "Addis Ababa",
    subcity: "Kirkos",
    ratingAvg: 4.9,
    ratingCount: 154,
    responseRate: 99,
    responseTime: "within minutes",
    memberSince: "2023-11-02",
    isVerified: true,
    isPremium: true,
  },
];

function img(seed: string, w: number, h: number) {
  return { id: seed, url: `https://picsum.photos/seed/${seed}/${w}/${h}`, width: w, height: h };
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export const listings: Listing[] = [
  {
    id: "l-1001",
    title: "iPhone 13 Pro 256GB — Sierra Blue",
    description:
      "Excellent condition, battery health 91%. Comes with original box, charger and a spare case. No cracks, screen protector on since day one. Selling because I upgraded.",
    priceCents: 8500000,
    isNegotiable: true,
    acceptsSwap: false,
    condition: "like_new",
    status: "active",
    categoryId: "cat-phones",
    categoryName: "Phones & Tablets",
    city: "Addis Ababa",
    subcity: "Bole",
    landmark: "Near Edna Mall",
    images: [img("iphone13-1", 1200, 1200), img("iphone13-2", 1200, 1200), img("iphone13-3", 1200, 1200)],
    seller: sellers[0]!,
    publishedAt: daysAgo(1),
    viewCount: 214,
    saveCount: 19,
    promotion: "featured",
    attributes: { Brand: "Apple", Model: "iPhone 13 Pro", Storage: "256GB", "Battery health": "91%" },
  },
  {
    id: "l-1002",
    title: "3-Seat Fabric Sofa, Grey",
    description:
      "Comfortable grey fabric sofa, used for about a year. Minor wear on one armrest, otherwise clean and sturdy. Buyer arranges pickup — I'm on the 2nd floor, no elevator.",
    priceCents: 1200000,
    isNegotiable: true,
    acceptsSwap: true,
    condition: "good",
    status: "active",
    categoryId: "cat-furniture",
    categoryName: "Furniture",
    city: "Addis Ababa",
    subcity: "Yeka",
    images: [img("sofa-1", 1200, 900), img("sofa-2", 1200, 900)],
    seller: sellers[1]!,
    publishedAt: daysAgo(2),
    viewCount: 98,
    saveCount: 7,
    promotion: null,
  },
  {
    id: "l-1003",
    title: "Toyota Vitz 2015, well maintained",
    description:
      "Single owner, full service history at authorized garage. 98,000 km. New tires last month. AC works perfectly. Price is slightly negotiable for serious buyers only.",
    priceCents: 165000000,
    isNegotiable: true,
    acceptsSwap: false,
    condition: "good",
    status: "active",
    categoryId: "cat-vehicles",
    categoryName: "Vehicles",
    city: "Addis Ababa",
    subcity: "Nifas Silk-Lafto",
    images: [img("vitz-1", 1200, 900), img("vitz-2", 1200, 900), img("vitz-3", 1200, 900), img("vitz-4", 1200, 900)],
    seller: sellers[2]!,
    publishedAt: daysAgo(4),
    viewCount: 342,
    saveCount: 41,
    promotion: "urgent",
    attributes: { Year: "2015", Mileage: "98,000 km", Fuel: "Petrol", Transmission: "Manual" },
  },
  {
    id: "l-1004",
    title: "Women's leather handbag, barely used",
    description:
      "Beautiful genuine leather handbag, used twice. Selling because it was a duplicate gift. Comes with dust bag.",
    priceCents: 320000,
    isNegotiable: false,
    acceptsSwap: true,
    condition: "like_new",
    status: "active",
    categoryId: "cat-fashion",
    categoryName: "Fashion",
    city: "Addis Ababa",
    subcity: "Kirkos",
    images: [img("bag-1", 1000, 1200), img("bag-2", 1000, 1200)],
    seller: sellers[3]!,
    publishedAt: daysAgo(1),
    viewCount: 156,
    saveCount: 33,
    promotion: null,
  },
  {
    id: "l-1005",
    title: "Dell Latitude Laptop, i5, 8GB RAM",
    description:
      "Reliable office laptop. 256GB SSD, fast boot, good battery (about 4 hours). Light scratches on the lid, screen is flawless. Charger included.",
    priceCents: 2800000,
    isNegotiable: true,
    acceptsSwap: false,
    condition: "good",
    status: "active",
    categoryId: "cat-electronics",
    categoryName: "Electronics",
    city: "Addis Ababa",
    subcity: "Bole",
    images: [img("laptop-1", 1200, 900)],
    seller: sellers[0]!,
    publishedAt: daysAgo(6),
    viewCount: 77,
    saveCount: 5,
    promotion: null,
    attributes: { Brand: "Dell", Model: "Latitude 5490", RAM: "8GB", Storage: "256GB SSD" },
  },
  {
    id: "l-1006",
    title: "Kids bicycle, ages 5-8",
    description: "Sturdy kids bike, training wheels included. Outgrown quickly, hardly used.",
    priceCents: 180000,
    isNegotiable: true,
    acceptsSwap: true,
    condition: "good",
    status: "active",
    categoryId: "cat-kids",
    categoryName: "Kids & Baby",
    city: "Addis Ababa",
    subcity: "Lideta",
    images: [img("bike-1", 1100, 1100)],
    seller: sellers[1]!,
    publishedAt: daysAgo(3),
    viewCount: 41,
    saveCount: 2,
    promotion: null,
  },
  {
    id: "l-1007",
    title: "Samsung 55'' 4K Smart TV",
    description:
      "Crisp 4K picture, built-in apps (YouTube, Netflix). Wall mount bracket included. Selling due to moving abroad.",
    priceCents: 4200000,
    isNegotiable: false,
    acceptsSwap: false,
    condition: "like_new",
    status: "reserved",
    categoryId: "cat-electronics",
    categoryName: "Electronics",
    city: "Addis Ababa",
    subcity: "Bole",
    images: [img("tv-1", 1200, 900), img("tv-2", 1200, 900)],
    seller: sellers[0]!,
    publishedAt: daysAgo(5),
    viewCount: 189,
    saveCount: 22,
    promotion: "homepage",
  },
  {
    id: "l-1008",
    title: "Wooden dining table + 4 chairs",
    description: "Solid wood dining set, seats four comfortably. Some scuffs on legs, top is in great shape.",
    priceCents: 950000,
    isNegotiable: true,
    acceptsSwap: false,
    condition: "fair",
    status: "active",
    categoryId: "cat-furniture",
    categoryName: "Furniture",
    city: "Adama",
    subcity: "Adama Ketema",
    images: [img("table-1", 1200, 900)],
    seller: sellers[2]!,
    publishedAt: daysAgo(9),
    viewCount: 63,
    saveCount: 4,
    promotion: null,
  },
  {
    id: "l-1009",
    title: "Men's running shoes, size 42, new",
    description: "Never worn, wrong size ordered online. Original box included.",
    priceCents: 210000,
    isNegotiable: false,
    acceptsSwap: false,
    condition: "new",
    status: "active",
    categoryId: "cat-fashion",
    categoryName: "Fashion",
    city: "Addis Ababa",
    subcity: "Kirkos",
    images: [img("shoes-1", 1100, 1100)],
    seller: sellers[3]!,
    publishedAt: daysAgo(1),
    viewCount: 132,
    saveCount: 26,
    promotion: "urgent",
  },
  {
    id: "l-1010",
    title: "Espresso machine, semi-automatic",
    description: "Makes great espresso and steamed milk. Descaled regularly, works like new.",
    priceCents: 750000,
    isNegotiable: true,
    acceptsSwap: true,
    condition: "good",
    status: "active",
    categoryId: "cat-home",
    categoryName: "Home & Garden",
    city: "Addis Ababa",
    subcity: "Yeka",
    images: [img("espresso-1", 1100, 1100)],
    seller: sellers[1]!,
    publishedAt: daysAgo(7),
    viewCount: 54,
    saveCount: 8,
    promotion: null,
  },
  {
    id: "l-1011",
    title: "Guitar, acoustic, with case",
    description: "Great beginner guitar, nice tone, comes with a padded gig bag and extra strings.",
    priceCents: 480000,
    isNegotiable: true,
    acceptsSwap: true,
    condition: "good",
    status: "active",
    categoryId: "cat-hobbies",
    categoryName: "Books & Hobbies",
    city: "Bahir Dar",
    subcity: "Belay Zeleke",
    images: [img("guitar-1", 1000, 1200)],
    seller: sellers[2]!,
    publishedAt: daysAgo(2),
    viewCount: 47,
    saveCount: 6,
    promotion: null,
  },
  {
    id: "l-1012",
    title: "Baby stroller, foldable, all-terrain",
    description: "Sturdy stroller, big wheels handle uneven roads well. Rain cover included.",
    priceCents: 550000,
    isNegotiable: true,
    acceptsSwap: false,
    condition: "good",
    status: "active",
    categoryId: "cat-kids",
    categoryName: "Kids & Baby",
    city: "Addis Ababa",
    subcity: "Bole",
    images: [img("stroller-1", 1100, 1100)],
    seller: sellers[0]!,
    publishedAt: daysAgo(10),
    viewCount: 39,
    saveCount: 3,
    promotion: null,
  },
];

export const cities = ["Addis Ababa", "Adama", "Hawassa", "Bahir Dar", "Mekelle"] as const;

export function getCategoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug) ?? null;
}

export function getListingById(id: string) {
  return listings.find((l) => l.id === id) ?? null;
}

export function getSimilarListings(listing: Listing, limit = 4) {
  return listings
    .filter(
      (l) =>
        l.id !== listing.id &&
        l.categoryId === listing.categoryId &&
        l.city === listing.city &&
        Math.abs(l.priceCents - listing.priceCents) <= listing.priceCents * 0.6
    )
    .slice(0, limit);
}

export function getSellerOtherListings(sellerId: string, excludeId: string, limit = 4) {
  return listings.filter((l) => l.seller.id === sellerId && l.id !== excludeId).slice(0, limit);
}
