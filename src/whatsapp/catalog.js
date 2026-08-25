const prisma = require('../lib/prisma');

function listCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { items: { where: { available: true } } } } },
  });
}

function listAvailableItems(categoryId) {
  return prisma.menuItem.findMany({
    where: { categoryId, available: true },
    orderBy: { name: 'asc' },
  });
}

function listAvailableServices() {
  return prisma.service.findMany({ where: { available: true }, orderBy: { name: 'asc' } });
}

function findOrCreateCustomer(phone) {
  return prisma.customer.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
}

module.exports = { listCategories, listAvailableItems, listAvailableServices, findOrCreateCustomer };
