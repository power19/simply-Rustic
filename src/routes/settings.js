const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const {
  getStoreSettings,
  setStoreSettings,
  CURRENCY_OPTIONS,
  addNotificationNumber,
  removeNotificationNumber,
} = require('../lib/settings');

const router = express.Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const [users, storeSettings, notificationNumbers] = await Promise.all([
    prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } }),
    getStoreSettings(),
    prisma.notificationNumber.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);
  const isPreset = CURRENCY_OPTIONS.some((opt) => opt.prefix === storeSettings.currencySymbol);
  res.render('settings/index', {
    title: 'Settings',
    users,
    storeSettings,
    currencyOptions: CURRENCY_OPTIONS,
    customCurrency: isPreset ? '' : storeSettings.currencySymbol,
    notificationNumbers,
  });
});

router.post('/store', async (req, res) => {
  const { businessName, currencySymbol, customCurrency } = req.body;
  // Only trim the free-typed custom value (guards against accidental whitespace).
  // Preset dropdown values are used exactly as defined - SRD's trailing space is
  // intentional (see CURRENCY_OPTIONS) and must survive the round trip.
  const trimmedCustom = (customCurrency || '').trim();
  const resolvedSymbol = trimmedCustom || currencySymbol;
  if (!businessName || !businessName.trim() || !resolvedSymbol) {
    req.flash('error', 'Business name and currency are both required.');
    return res.redirect('/settings');
  }

  await setStoreSettings({ businessName: businessName.trim(), currencySymbol: resolvedSymbol });
  req.flash('success', 'Store details updated.');
  res.redirect('/settings');
});

router.post('/notifications', async (req, res) => {
  const { number, label } = req.body;
  const digits = (number || '').replace(/\D/g, '');
  if (digits.length < 7) {
    req.flash('error', 'Enter a valid WhatsApp number with country code (digits only, at least 7 digits).');
    return res.redirect('/settings');
  }

  try {
    await addNotificationNumber(digits, label ? label.trim() : null);
    req.flash('success', 'Notification number added.');
  } catch (err) {
    req.flash('error', 'That number is already on the list.');
  }
  res.redirect('/settings');
});

router.post('/notifications/:id/delete', async (req, res) => {
  await removeNotificationNumber(Number(req.params.id));
  req.flash('success', 'Notification number removed.');
  res.redirect('/settings');
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
