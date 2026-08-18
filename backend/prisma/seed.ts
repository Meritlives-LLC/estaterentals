// backend/prisma/seed.ts
import 'dotenv/config'
import { PrismaClient, PriceUnit, PropertyType, PropertyStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Admin credentials from environment ───────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  const adminName = process.env.SEED_ADMIN_NAME ?? 'EstatePro Admin'

  if (!adminEmail || !adminPassword) {
    throw new Error(
      '❌ SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env before seeding.'
    )
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 12)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })

  let admin

  if (existingAdmin) {
    admin = existingAdmin

    console.log(
      `⏭️ Admin already exists: ${adminEmail}. Keeping existing password.`
    )
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 12)

    admin = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
      },
    })

    console.log(`✅ Admin created: ${adminEmail}`)
  }

  const properties = [
    {
      title: 'Luxury 3-Bedroom Apartment in Maitama',
      slug: 'luxury-3-bedroom-apartment-maitama',
      description: 'A stunning fully-furnished luxury apartment in the heart of Maitama. Features top-of-the-line finishes, floor-to-ceiling windows with panoramic city views, and access to world-class amenities.',
      price: 450000,
      priceUnit: PriceUnit.MONTH,
      location: 'Maitama District',
      city: 'Abuja',
      state: 'FCT',
      address: '14B Adetokunbo Ademola Crescent, Maitama',
      type: PropertyType.APARTMENT,
      status: PropertyStatus.ACTIVE,
      bedrooms: 3,
      bathrooms: 3,
      area: 220,
      featured: true,
      images: [
        { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80', publicId: 'seed_1a', alt: 'Living Room', order: 0 },
        { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80', publicId: 'seed_1b', alt: 'Bedroom', order: 1 },
      ],
      amenities: [
        { name: '24/7 Security' }, { name: 'Swimming Pool' }, { name: 'Gym' },
        { name: 'Parking' }, { name: 'Generator' }, { name: 'WiFi' },
      ],
    },
    {
      title: 'Modern 4-Bedroom Duplex in Asokoro',
      slug: 'modern-4-bedroom-duplex-asokoro',
      description: 'Exquisite modern duplex in the prestigious Asokoro district. Open-plan living, chef kitchen, en-suite bedrooms, and a beautifully landscaped garden.',
      price: 700000,
      priceUnit: PriceUnit.MONTH,
      location: 'Asokoro Extension',
      city: 'Abuja',
      state: 'FCT',
      address: '7 Ministers Hill, Asokoro Extension',
      type: PropertyType.DUPLEX,
      status: PropertyStatus.ACTIVE,
      bedrooms: 4,
      bathrooms: 4,
      area: 380,
      featured: true,
      images: [
        { url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', publicId: 'seed_2a', alt: 'Exterior', order: 0 },
      ],
      amenities: [
        { name: 'Private Garden' }, { name: 'Boys Quarters' }, { name: '3-Car Garage' },
        { name: 'Smart Home' }, { name: 'Solar Power' }, { name: 'CCTV' },
      ],
    },
    {
      title: 'Executive Studio in Wuse II',
      slug: 'executive-studio-wuse-2',
      description: 'Chic fully-serviced studio apartment in the bustling Wuse II commercial hub. All utilities included. Walking distance to banks and shopping.',
      price: 150000,
      priceUnit: PriceUnit.MONTH,
      location: 'Wuse II',
      city: 'Abuja',
      state: 'FCT',
      address: '22 Adeola Odeku Street, Wuse II',
      type: PropertyType.STUDIO,
      status: PropertyStatus.ACTIVE,
      bedrooms: 1,
      bathrooms: 1,
      area: 55,
      featured: false,
      images: [
        { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80', publicId: 'seed_3a', alt: 'Studio', order: 0 },
      ],
      amenities: [{ name: 'All Utilities' }, { name: 'Concierge' }, { name: 'WiFi' }],
    },
    {
      title: 'Spacious 5-Bedroom House in Gwarinpa',
      slug: 'spacious-5-bedroom-house-gwarinpa',
      description: 'Massive family home in serene Gwarinpa estate. Large compound, servant quarters, and ample parking.',
      price: 350000,
      priceUnit: PriceUnit.MONTH,
      location: 'Gwarinpa Estate',
      city: 'Abuja',
      state: 'FCT',
      address: '4th Avenue, Gwarinpa Housing Estate',
      type: PropertyType.HOUSE,
      status: PropertyStatus.ACTIVE,
      bedrooms: 5,
      bathrooms: 5,
      area: 500,
      featured: true,
      images: [
        { url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80', publicId: 'seed_4a', alt: 'House', order: 0 },
      ],
      amenities: [{ name: 'Large Compound' }, { name: 'Servant Quarters' }, { name: 'Borehole' }],
    },
    {
      title: 'Premium Penthouse in CBD',
      slug: 'premium-penthouse-cbd',
      description: 'Spectacular penthouse with 360° views of Abuja and Aso Rock. Private rooftop terrace, butler service, and ultra-luxury finishes.',
      price: 1200000,
      priceUnit: PriceUnit.MONTH,
      location: 'Central Business District',
      city: 'Abuja',
      state: 'FCT',
      address: 'Sapele Road, Central Business District',
      type: PropertyType.PENTHOUSE,
      status: PropertyStatus.ACTIVE,
      bedrooms: 4,
      bathrooms: 5,
      area: 650,
      featured: true,
      images: [
        { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', publicId: 'seed_5a', alt: 'Penthouse', order: 0 },
      ],
      amenities: [{ name: 'Private Rooftop' }, { name: 'Butler Service' }, { name: 'Private Elevator' }],
    },
    {
      title: '2-Bedroom Apartment in Garki',
      slug: '2-bedroom-apartment-garki',
      description: 'Well-maintained 2-bedroom apartment in Area 11, Garki. Close to government offices and commercial centres.',
      price: 120000,
      priceUnit: PriceUnit.MONTH,
      location: 'Garki Area 11',
      city: 'Abuja',
      state: 'FCT',
      address: 'Hospital Road, Garki Area 11',
      type: PropertyType.APARTMENT,
      status: PropertyStatus.ACTIVE,
      bedrooms: 2,
      bathrooms: 2,
      area: 110,
      featured: false,
      images: [
        { url: 'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=1200&q=80', publicId: 'seed_6a', alt: 'Apartment', order: 0 },
      ],
      amenities: [{ name: 'Security' }, { name: 'Parking' }, { name: 'Generator' }],
    },
  ]

  for (const { images, amenities, ...propertyData } of properties) {
    // Skip if slug already exists — safe to re-run on every deploy
    const existing = await prisma.property.findUnique({ where: { slug: propertyData.slug } })
    if (existing) {
      console.log(`⏭️  Already exists, skipping: ${propertyData.title}`)
      continue
    }

    const p = await prisma.property.create({
      data: {
        ...propertyData,
        images: { create: images },
        amenities: { create: amenities },
      },
    })
    console.log(`✅ Property: ${p.title}`)
  }

  // Only seed messages if the table is empty
  const messageCount = await prisma.message.count()
  if (messageCount === 0) {
    await prisma.message.createMany({
      data: [
        {
          name: 'Emeka Okafor',
          email: 'emeka@gmail.com',
          phone: '+2348034567890',
          subject: 'Enquiry about Maitama Apartment',
          body: 'Hello, I am interested in the 3-bedroom apartment in Maitama. Please send availability details.',
          status: 'UNREAD',
        },
        {
          name: 'Amina Ibrahim',
          email: 'amina@yahoo.com',
          phone: '+2348067890123',
          subject: 'Asokoro Duplex Viewing',
          body: 'I would like to schedule a viewing for the Asokoro duplex. Available weekdays after 4pm.',
          status: 'READ',
        },
        {
          name: 'David Mensah',
          email: 'd.mensah@company.com',
          subject: 'Corporate Accommodation',
          body: 'Seeking serviced apartments for visiting executives. Monthly rental basis.',
          status: 'UNREAD',
        },
      ],
    })
    console.log('✅ Messages seeded')
  } else {
    console.log(`⏭️  Messages already exist (${messageCount}), skipping`)
  }

  console.log('\n🎉 Seed complete!')
  console.log(`📧 Admin: ${adminEmail}`)
  console.log('🔑 Password: (as set in SEED_ADMIN_PASSWORD)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())