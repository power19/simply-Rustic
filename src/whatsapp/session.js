const prisma = require('../lib/prisma');

async function getSession(phone) {
  let session = await prisma.chatSession.findUnique({ where: { phone } });
  if (!session) {
    session = await prisma.chatSession.create({ data: { phone } });
  }
  return { ...session, cart: JSON.parse(session.cartJson || '[]') };
}

async function saveSession(phone, { step, categoryId, cart }) {
  return prisma.chatSession.update({
    where: { phone },
    data: {
      step,
      categoryId: categoryId ?? null,
      cartJson: JSON.stringify(cart ?? []),
    },
  });
}

async function resetSession(phone) {
  return saveSession(phone, { step: 'MAIN', categoryId: null, cart: [] });
}

module.exports = { getSession, saveSession, resetSession };
