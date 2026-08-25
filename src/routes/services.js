const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const services = await prisma.service.findMany({ orderBy: { name: 'asc' } });
  res.render('services/index', { title: 'Services', services });
});

router.get('/new', (req, res) => {
  res.render('services/form', { title: 'Add Service', service: null });
});

router.post('/', async (req, res) => {
  const { name, description, price, available } = req.body;
  await prisma.service.create({
    data: {
      name: name.trim(),
      description: description || null,
      price: price ? parseFloat(price) : null,
      available: available === 'on',
    },
  });
  req.flash('success', 'Service added.');
  res.redirect('/services');
});

router.get('/:id/edit', async (req, res) => {
  const service = await prisma.service.findUnique({ where: { id: Number(req.params.id) } });
  if (!service) return res.redirect('/services');
  res.render('services/form', { title: 'Edit Service', service });
});

router.post('/:id', async (req, res) => {
  const { name, description, price, available } = req.body;
  await prisma.service.update({
    where: { id: Number(req.params.id) },
    data: {
      name: name.trim(),
      description: description || null,
      price: price ? parseFloat(price) : null,
      available: available === 'on',
    },
  });
  req.flash('success', 'Service updated.');
  res.redirect('/services');
});

router.post('/:id/delete', async (req, res) => {
  await prisma.service.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.redirect('/services');
});

module.exports = router;
