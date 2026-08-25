const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/login', { title: 'Log in' });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.adminUser.findUnique({ where: { username } });

  if (!user) {
    req.flash('error', 'Invalid username or password.');
    return res.redirect('/login');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    req.flash('error', 'Invalid username or password.');
    return res.redirect('/login');
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
