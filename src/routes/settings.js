const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const users = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
  res.render('settings/index', { title: 'Settings', users });
});

router.post('/users', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim() || !password || password.length < 8) {
    req.flash('error', 'Username is required and password must be at least 8 characters.');
    return res.redirect('/settings');
  }

  const existing = await prisma.adminUser.findUnique({ where: { username: username.trim() } });
  if (existing) {
    req.flash('error', 'That username is already taken.');
    return res.redirect('/settings');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({ data: { username: username.trim(), passwordHash } });
  req.flash('success', `Admin user "${username.trim()}" created.`);
  res.redirect('/settings');
});

router.post('/users/:id/delete', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.userId) {
    req.flash('error', 'You cannot delete your own account while logged in.');
    return res.redirect('/settings');
  }

  const totalUsers = await prisma.adminUser.count();
  if (totalUsers <= 1) {
    req.flash('error', 'Cannot delete the last remaining admin user.');
    return res.redirect('/settings');
  }

  await prisma.adminUser.delete({ where: { id } }).catch(() => {});
  req.flash('success', 'Admin user removed.');
  res.redirect('/settings');
});

router.post('/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  const user = await prisma.adminUser.findUnique({ where: { id: req.session.userId } });
  const valid = user && (await bcrypt.compare(currentPassword || '', user.passwordHash));
  if (!valid) {
    req.flash('error', 'Current password is incorrect.');
    return res.redirect('/settings');
  }

  if (!newPassword || newPassword.length < 8) {
    req.flash('error', 'New password must be at least 8 characters.');
    return res.redirect('/settings');
  }
  if (newPassword !== confirmPassword) {
    req.flash('error', 'New password and confirmation do not match.');
    return res.redirect('/settings');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } });
  req.flash('success', 'Password updated.');
  res.redirect('/settings');
});

module.exports = router;
