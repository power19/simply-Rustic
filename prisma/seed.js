require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin user "${username}" already exists, skipping.`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.adminUser.create({ data: { username, passwordHash } });
    console.log(`Created admin user "${username}".`);
  }

  const categoryCount = await prisma.category.count();
  if (categoryCount === 0) {
    const starters = await prisma.category.create({ data: { name: 'Starters', sortOrder: 1 } });
    const mains = await prisma.category.create({ data: { name: 'Main Courses', sortOrder: 2 } });
    const desserts = await prisma.category.create({ data: { name: 'Desserts', sortOrder: 3 } });

    await prisma.menuItem.createMany({
      data: [
        { name: 'Butternut Soup', description: 'Roasted butternut, cream, toasted seeds', price: 45, categoryId: starters.id },
        { name: 'Bruschetta', description: 'Grilled sourdough, tomato, basil, olive oil', price: 55, categoryId: starters.id },
        { name: 'Beef Bobotie', description: 'Traditional spiced mince bake with yellow rice', price: 145, categoryId: mains.id },
        { name: 'Grilled Chicken Platter', description: 'Herb-marinated chicken, seasonal veg, potatoes', price: 135, categoryId: mains.id },
        { name: 'Malva Pudding', description: 'Warm malva pudding with custard', price: 55, categoryId: desserts.id },
      ],
    });

    await prisma.service.createMany({
      data: [
        { name: 'Wedding Catering', description: 'Full-service catering for weddings, from 50 to 300 guests.', price: null },
        { name: 'Corporate Events', description: 'Buffet or plated catering for meetings, launches and functions.', price: null },
        { name: 'Private Chef Dinner', description: 'A private chef cooks a bespoke menu at your home.', price: 1200 },
      ],
    });

    console.log('Seeded sample menu categories, items and services.');
  } else {
    console.log('Menu already has categories, skipping menu seed.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
