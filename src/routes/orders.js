const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

const STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'COMPLETED', 'CANCELLED'];

router.get('/', async (req, res) => {
  const filter = STATUSES.includes(req.query.status) ? req.query.status : null;
  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { customer: true, items: { include: { menuItem: true } }, service: true },
  });
  res.render('orders/index', { title: 'Orders', orders, filter, statuses: STATUSES });
});

router.post('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.redirect('/orders');
  await prisma.order.update({ where: { id: Number(req.params.id) }, data: { status } });
  res.redirect('/orders');
});

module.exports = router;
