const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const menuRoutes = require('./routes/menu');
const serviceRoutes = require('./routes/services');
const orderRoutes = require('./routes/orders');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride('_method'));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 8 },
    })
  );
  app.use(flash());

  app.use((req, res, next) => {
    res.locals.currentUser = req.session.username || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.businessName = process.env.BUSINESS_NAME || 'Simply Rustic Catering';
    res.locals.currencySymbol = process.env.CURRENCY_SYMBOL || 'R';
    res.locals.path = req.path;
    next();
  });

  app.use('/', authRoutes);
  app.use('/', dashboardRoutes);
  app.use('/menu', menuRoutes);
  app.use('/services', serviceRoutes);
  app.use('/orders', orderRoutes);

  app.use((req, res) => {
    res.status(404).render('404', { title: 'Not found' });
  });

  return app;
}

module.exports = createApp;
