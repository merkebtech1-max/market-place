import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('🌱 Starting seed...');

  // ============================================================
  // CATEGORIES - Hierarchical Structure (Idempotent with upsert)
  // ============================================================
  console.log('📁 Seeding categories...');

  // Root categories
  const electronics = await prisma.category.upsert({
    where: { slug: 'electronics' },
    update: {},
    create: {
      slug: 'electronics',
      nameEn: 'Electronics',
      nameAm: 'ኤሌክትሮኒክስ',
      icon: 'electronics',
      sort: 1,
      isActive: true,
    },
  });

  const vehicles = await prisma.category.upsert({
    where: { slug: 'vehicles' },
    update: {},
    create: {
      slug: 'vehicles',
      nameEn: 'Vehicles',
      nameAm: 'ተሽከርካሪዎች',
      icon: 'vehicles',
      sort: 2,
      isActive: true,
    },
  });

  const property = await prisma.category.upsert({
    where: { slug: 'property' },
    update: {},
    create: {
      slug: 'property',
      nameEn: 'Property',
      nameAm: 'ንብረት',
      icon: 'property',
      sort: 3,
      isActive: true,
    },
  });

  const fashion = await prisma.category.upsert({
    where: { slug: 'fashion' },
    update: {},
    create: {
      slug: 'fashion',
      nameEn: 'Fashion',
      nameAm: 'ፋሽን',
      icon: 'fashion',
      sort: 4,
      isActive: true,
    },
  });

  const home = await prisma.category.upsert({
    where: { slug: 'home' },
    update: {},
    create: {
      slug: 'home',
      nameEn: 'Home & Garden',
      nameAm: 'ቤት እና ግማሽ',
      icon: 'home',
      sort: 5,
      isActive: true,
    },
  });

  const services = await prisma.category.upsert({
    where: { slug: 'services' },
    update: {},
    create: {
      slug: 'services',
      nameEn: 'Services',
      nameAm: 'አገልግሎቶች',
      icon: 'services',
      sort: 6,
      isActive: true,
    },
  });

  // Electronics children
  const phones = await prisma.category.upsert({
    where: { slug: 'phones' },
    update: {},
    create: {
      parentId: electronics.id,
      slug: 'phones',
      nameEn: 'Phones',
      nameAm: 'ስልኮች',
      icon: 'phone',
      sort: 1,
      isActive: true,
    },
  });

  const laptops = await prisma.category.upsert({
    where: { slug: 'laptops' },
    update: {},
    create: {
      parentId: electronics.id,
      slug: 'laptops',
      nameEn: 'Laptops',
      nameAm: 'ላፕቶፕስ',
      icon: 'laptop',
      sort: 2,
      isActive: true,
    },
  });

  const tvs = await prisma.category.upsert({
    where: { slug: 'tvs' },
    update: {},
    create: {
      parentId: electronics.id,
      slug: 'tvs',
      nameEn: 'TVs',
      nameAm: 'ቲቪዎች',
      icon: 'tv',
      sort: 3,
      isActive: true,
    },
  });

  const tablets = await prisma.category.upsert({
    where: { slug: 'tablets' },
    update: {},
    create: {
      parentId: electronics.id,
      slug: 'tablets',
      nameEn: 'Tablets',
      nameAm: 'ታብሌቶች',
      icon: 'tablet',
      sort: 4,
      isActive: true,
    },
  });

  const accessories = await prisma.category.upsert({
    where: { slug: 'accessories' },
    update: {},
    create: {
      parentId: electronics.id,
      slug: 'accessories',
      nameEn: 'Accessories',
      nameAm: 'ተጨማሪዎች',
      icon: 'accessories',
      sort: 5,
      isActive: true,
    },
  });

  // Vehicles children
  const cars = await prisma.category.upsert({
    where: { slug: 'cars' },
    update: {},
    create: {
      parentId: vehicles.id,
      slug: 'cars',
      nameEn: 'Cars',
      nameAm: 'መኪኖች',
      icon: 'car',
      sort: 1,
      isActive: true,
    },
  });

  const motorcycles = await prisma.category.upsert({
    where: { slug: 'motorcycles' },
    update: {},
    create: {
      parentId: vehicles.id,
      slug: 'motorcycles',
      nameEn: 'Motorcycles',
      nameAm: 'ሞተርሳይክሎች',
      icon: 'motorcycle',
      sort: 2,
      isActive: true,
    },
  });

  const parts = await prisma.category.upsert({
    where: { slug: 'parts' },
    update: {},
    create: {
      parentId: vehicles.id,
      slug: 'parts',
      nameEn: 'Spare Parts',
      nameAm: 'ተለዋዋጮች',
      icon: 'parts',
      sort: 3,
      isActive: true,
    },
  });

  // Property children
  const apartments = await prisma.category.upsert({
    where: { slug: 'apartments' },
    update: {},
    create: {
      parentId: property.id,
      slug: 'apartments',
      nameEn: 'Apartments',
      nameAm: 'አፓርታማዎች',
      icon: 'apartment',
      sort: 1,
      isActive: true,
    },
  });

  const houses = await prisma.category.upsert({
    where: { slug: 'houses' },
    update: {},
    create: {
      parentId: property.id,
      slug: 'houses',
      nameEn: 'Houses',
      nameAm: 'ቤቶች',
      icon: 'house',
      sort: 2,
      isActive: true,
    },
  });

  const land = await prisma.category.upsert({
    where: { slug: 'land' },
    update: {},
    create: {
      parentId: property.id,
      slug: 'land',
      nameEn: 'Land',
      nameAm: 'መሬት',
      icon: 'land',
      sort: 3,
      isActive: true,
    },
  });

  // Fashion children
  const mensFashion = await prisma.category.upsert({
    where: { slug: 'mens-fashion' },
    update: {},
    create: {
      parentId: fashion.id,
      slug: 'mens-fashion',
      nameEn: "Men's Fashion",
      nameAm: 'የወንዶች ፋሽን',
      icon: 'mens',
      sort: 1,
      isActive: true,
    },
  });

  const womensFashion = await prisma.category.upsert({
    where: { slug: 'womens-fashion' },
    update: {},
    create: {
      parentId: fashion.id,
      slug: 'womens-fashion',
      nameEn: "Women's Fashion",
      nameAm: 'የሴቶች ፋሽን',
      icon: 'womens',
      sort: 2,
      isActive: true,
    },
  });

  const kidsFashion = await prisma.category.upsert({
    where: { slug: 'kids-fashion' },
    update: {},
    create: {
      parentId: fashion.id,
      slug: 'kids-fashion',
      nameEn: "Kids' Fashion",
      nameAm: 'የልጆች ፋሽን',
      icon: 'kids',
      sort: 3,
      isActive: true,
    },
  });

  // Home children
  const furniture = await prisma.category.upsert({
    where: { slug: 'furniture' },
    update: {},
    create: {
      parentId: home.id,
      slug: 'furniture',
      nameEn: 'Furniture',
      nameAm: 'ዕቃዎች',
      icon: 'furniture',
      sort: 1,
      isActive: true,
    },
  });

  const kitchen = await prisma.category.upsert({
    where: { slug: 'kitchen' },
    update: {},
    create: {
      parentId: home.id,
      slug: 'kitchen',
      nameEn: 'Kitchen',
      nameAm: 'ምግብ ቤት',
      icon: 'kitchen',
      sort: 2,
      isActive: true,
    },
  });

  const garden = await prisma.category.upsert({
    where: { slug: 'garden' },
    update: {},
    create: {
      parentId: home.id,
      slug: 'garden',
      nameEn: 'Garden',
      nameAm: 'ገበታ',
      icon: 'garden',
      sort: 3,
      isActive: true,
    },
  });

  // Services children
  const tutoring = await prisma.category.upsert({
    where: { slug: 'tutoring' },
    update: {},
    create: {
      parentId: services.id,
      slug: 'tutoring',
      nameEn: 'Tutoring',
      nameAm: 'ትምህርት',
      icon: 'tutoring',
      sort: 1,
      isActive: true,
    },
  });

  const repair = await prisma.category.upsert({
    where: { slug: 'repair' },
    update: {},
    create: {
      parentId: services.id,
      slug: 'repair',
      nameEn: 'Repair Services',
      nameAm: 'የጥገና አገልግሎቶች',
      icon: 'repair',
      sort: 2,
      isActive: true,
    },
  });

  const cleaning = await prisma.category.upsert({
    where: { slug: 'cleaning' },
    update: {},
    create: {
      parentId: services.id,
      slug: 'cleaning',
      nameEn: 'Cleaning',
      nameAm: 'ንጹሕነት',
      icon: 'cleaning',
      sort: 3,
      isActive: true,
    },
  });

  console.log(`✅ Seeded ${await prisma.category.count()} categories`);

  // ============================================================
  // LOCATIONS - Hierarchical Structure (Idempotent)
  // ============================================================
  console.log('📍 Seeding locations...');

  // Helper function for idempotent location creation
  const createLocation = async (data: any) => {
    const existing = await prisma.location.findFirst({
      where: {
        nameEn: data.nameEn,
        type: data.type,
        parentId: data.parentId || null,
      },
    });
    if (existing) return existing;
    return prisma.location.create({ data });
  };

  // Regions
  const addisAbaba = await createLocation({
    type: 'REGION',
    nameEn: 'Addis Ababa',
    nameAm: 'አዲስ አበባ',
  });

  const oromia = await createLocation({
    type: 'REGION',
    nameEn: 'Oromia',
    nameAm: 'ኦሮሚያ',
  });

  const amhara = await createLocation({
    type: 'REGION',
    nameEn: 'Amhara',
    nameAm: 'አማራ',
  });

  const tigray = await createLocation({
    type: 'REGION',
    nameEn: 'Tigray',
    nameAm: 'ትግራይ',
  });

  const sNNPR = await createLocation({
    type: 'REGION',
    nameEn: 'SNNPR',
    nameAm: 'ደቡብ ብሔራዊ ክልላት',
  });

  // Addis Ababa Subcities (Addis Ababa is a region with subcities directly, no cities)
  const bole = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Bole',
    nameAm: 'ቦሌ',
  });

  const yeka = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Yeka',
    nameAm: 'የካ',
  });

  const kolfe = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Kolfe Keranio',
    nameAm: 'ቆለፌ ቀራንዮ',
  });

  const kirkos = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Kirkos',
    nameAm: 'ኪሮስ',
  });

  const arada = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Arada',
    nameAm: 'አራዳ',
  });

  const lideta = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Lideta',
    nameAm: 'ልደታ',
  });

  const gulele = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Gulele',
    nameAm: 'ጉለሌ',
  });

  const akaky = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Akaky Kaliti',
    nameAm: 'አቃቂ ቃሊቲ',
  });

  const nifas = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Nifas Silk-Lafto',
    nameAm: 'ኒፋስ ስልክ ላፍቶ',
  });

  const addisKetema = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Addis Ketema',
    nameAm: 'አዲስ ከተማ',
  });

  const lemi = await createLocation({
    parentId: addisAbaba.id,
    type: 'SUBCITY',
    nameEn: 'Lemi Kura',
    nameAm: 'ለሚ ኩራ',
  });

  // Oromia Cities
  const adama = await createLocation({
    parentId: oromia.id,
    type: 'CITY',
    nameEn: 'Adama',
    nameAm: 'አዳማ',
  });

  const hawassa = await createLocation({
    parentId: oromia.id,
    type: 'CITY',
    nameEn: 'Hawassa',
    nameAm: 'ሃዋሳ',
  });

  const jimma = await createLocation({
    parentId: oromia.id,
    type: 'CITY',
    nameEn: 'Jimma',
    nameAm: 'ጅማ',
  });

  const bishoftu = await createLocation({
    parentId: oromia.id,
    type: 'CITY',
    nameEn: 'Bishoftu',
    nameAm: 'ቢሸፍቱ',
  });

  // Amhara Cities
  const bahirDar = await createLocation({
    parentId: amhara.id,
    type: 'CITY',
    nameEn: 'Bahir Dar',
    nameAm: 'ባህር ዳር',
  });

  const gondar = await createLocation({
    parentId: amhara.id,
    type: 'CITY',
    nameEn: 'Gondar',
    nameAm: 'ጎንደር',
  });

  const dessie = await createLocation({
    parentId: amhara.id,
    type: 'CITY',
    nameEn: 'Dessie',
    nameAm: 'ደሴ',
  });

  // Tigray Cities
  const mekelle = await createLocation({
    parentId: tigray.id,
    type: 'CITY',
    nameEn: 'Mekelle',
    nameAm: 'መቀሌ',
  });

  const adigrat = await createLocation({
    parentId: tigray.id,
    type: 'CITY',
    nameEn: 'Adigrat',
    nameAm: 'አዲግራት',
  });

  const axum = await createLocation({
    parentId: tigray.id,
    type: 'CITY',
    nameEn: 'Axum',
    nameAm: 'አክሱም',
  });

  console.log(`✅ Seeded ${await prisma.location.count()} locations`);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
