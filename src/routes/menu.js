const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'public', 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image uploads are allowed'));
  },
});

router.use(requireAuth);

// Swaps sortOrder between a record and its neighbor in a given direction.
async function moveInList(model, list, id, direction) {
  const index = list.findIndex((row) => row.id === id);
  if (index === -1) return;
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= list.length) return;

  const current = list[index];
  const neighbor = list[neighborIndex];
  await prisma.$transaction([
    model.update({ where: { id: current.id }, data: { sortOrder: neighbor.sortOrder } }),
    model.update({ where: { id: neighbor.id }, data: { sortOrder: current.sortOrder } }),
  ]);
}

// ---- Categories ----
router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (name && name.trim()) {
    const max = await prisma.category.aggregate({ _max: { sortOrder: true } });
    await prisma.category.create({
      data: { name: name.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  }
  res.redirect('/menu');
});

router.post('/categories/:id/move', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  await moveInList(prisma.category, categories, Number(req.params.id), req.body.direction);
  res.redirect('/menu');
});

router.post('/categories/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  const itemCount = await prisma.menuItem.count({ where: { categoryId: id } });
  if (itemCount > 0) {
    req.flash('error', 'Cannot delete a category that still has menu items.');
    return res.redirect('/menu');
  }
  await prisma.category.delete({ where: { id } });
  res.redirect('/menu');
});

// ---- Menu items ----
router.get('/', async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  res.render('menu/index', { title: 'Menu', categories });
});

router.get('/new', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  res.render('menu/form', { title: 'Add Menu Item', item: null, categories });
});

router.post('/', upload.single('image'), async (req, res) => {
  const { name, description, price, categoryId, available } = req.body;
  const max = await prisma.menuItem.aggregate({
    where: { categoryId: Number(categoryId) },
    _max: { sortOrder: true },
  });
  await prisma.menuItem.create({
    data: {
      name: name.trim(),
      description: description || null,
      price: parseFloat(price) || 0,
      categoryId: Number(categoryId),
      available: available === 'on',
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    },
  });
  req.flash('success', 'Menu item added.');
  res.redirect('/menu');
});

router.get('/:id/edit', async (req, res) => {
  const [item, categories] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: Number(req.params.id) } }),
    prisma.category.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  if (!item) return res.redirect('/menu');
  res.render('menu/form', { title: 'Edit Menu Item', item, categories });
});

router.post('/:id', upload.single('image'), async (req, res) => {
  const { name, description, price, categoryId, available } = req.body;
  const data = {
    name: name.trim(),
    description: description || null,
    price: parseFloat(price) || 0,
    categoryId: Number(categoryId),
    available: available === 'on',
  };
  if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;

  await prisma.menuItem.update({ where: { id: Number(req.params.id) }, data });
  req.flash('success', 'Menu item updated.');
  res.redirect('/menu');
});

router.post('/:id/move', async (req, res) => {
  const item = await prisma.menuItem.findUnique({ where: { id: Number(req.params.id) } });
  if (item) {
    const siblings = await prisma.menuItem.findMany({
      where: { categoryId: item.categoryId },
      orderBy: { sortOrder: 'asc' },
    });
    await moveInList(prisma.menuItem, siblings, item.id, req.body.direction);
  }
  res.redirect('/menu');
});

router.post('/:id/delete', async (req, res) => {
  await prisma.menuItem.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.redirect('/menu');
});

module.exports = router;
