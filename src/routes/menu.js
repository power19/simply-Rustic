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

// ---- Categories ----
router.post('/categories', async (req, res) => {
  const { name } = req.body;
  if (name && name.trim()) {
    await prisma.category.create({ data: { name: name.trim() } });
  }
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
    include: { items: { orderBy: { name: 'asc' } } },
  });
  res.render('menu/index', { title: 'Menu', categories });
});

router.get('/new', async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  res.render('menu/form', { title: 'Add Menu Item', item: null, categories });
});

router.post('/', upload.single('image'), async (req, res) => {
  const { name, description, price, categoryId, available } = req.body;
  await prisma.menuItem.create({
    data: {
      name: name.trim(),
      description: description || null,
      price: parseFloat(price) || 0,
      categoryId: Number(categoryId),
      available: available === 'on',
      imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    },
  });
  req.flash('success', 'Menu item added.');
  res.redirect('/menu');
});

router.get('/:id/edit', async (req, res) => {
  const [item, categories] = await Promise.all([
    prisma.menuItem.findUnique({ where: { id: Number(req.params.id) } }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
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

router.post('/:id/delete', async (req, res) => {
  await prisma.menuItem.delete({ where: { id: Number(req.params.id) } }).catch(() => {});
  res.redirect('/menu');
});

module.exports = router;
