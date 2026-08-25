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
    orderBy: { sortOrder: 'asc' },
  });
}

function listAvailableServices() {
  return prisma.service.findMany({ where: { available: true }, orderBy: { name: 'asc' } });
}

// `chatId` is WhatsApp's internal chat id: a real phone number for "@c.us"
// chats, but an opaque privacy id for "@lid" chats. `isRealNumber` tells us
// which, so we can auto-fill contactNumber only when it's actually a number.
function findOrCreateCustomer(chatId, isRealNumber) {
  return prisma.customer.upsert({
    where: { phone: chatId },
    update: {},
    create: { phone: chatId, contactNumber: isRealNumber ? chatId : null },
  });
}

module.exports = { listCategories, listAvailableItems, listAvailableServices, findOrCreateCustomer };
