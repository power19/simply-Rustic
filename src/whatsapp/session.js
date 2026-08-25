const prisma = require('../lib/prisma');

async function getSession(phone) {
  let session = await prisma.chatSession.findUnique({ where: { phone } });
  if (!session) {
    session = await prisma.chatSession.create({ data: { phone } });
  }
  return {
    ...session,
    cart: JSON.parse(session.cartJson || '[]'),
    draft: JSON.parse(session.draftJson || '{}'),
  };
}

async function saveSession(phone, { step, categoryId, cart, draft }) {
  return prisma.chatSession.update({
    where: { phone },
    data: {
      step,
      categoryId: categoryId ?? null,
      cartJson: JSON.stringify(cart ?? []),
      draftJson: JSON.stringify(draft ?? {}),
    },
  });
}

async function resetSession(phone) {
  return saveSession(phone, { step: 'MAIN', categoryId: null, cart: [], draft: {} });
}

module.exports = { getSession, saveSession, resetSession };
