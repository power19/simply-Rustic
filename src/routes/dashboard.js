const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const [pendingOrders, totalItems, totalServices, recentOrders] = await Promise.all([
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.menuItem.count(),
    prisma.service.count(),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { customer: true, items: { include: { menuItem: true } }, service: true },
    }),
  ]);

  res.render('dashboard', {
    title: 'Dashboard',
    pendingOrders,
    totalItems,
    totalServices,
    recentOrders,
    whatsapp: req.app.get('whatsappState'),
  });
});

router.get('/whatsapp', requireAuth, (req, res) => {
  res.render('whatsapp', { title: 'WhatsApp Connection', whatsapp: req.app.get('whatsappState') });
});

module.exports = router;
