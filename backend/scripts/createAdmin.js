const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

async function main() {
  const prisma = new PrismaClient()
  const email = process.env.SEED_ADMIN_EMAIL || 'test.admin@example.com'
  const password = process.env.SEED_ADMIN_PASSWORD || 'TestAdmin123!'
  const name = process.env.SEED_ADMIN_NAME || 'Test Admin'

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: 'ADMIN', name },
    create: { email, password: hashed, role: 'ADMIN', name },
  })

  console.log('Created/updated admin:', user.email)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
