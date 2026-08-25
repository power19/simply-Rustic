require('dotenv').config();

const createApp = require('./app');
const { initWhatsapp } = require('./whatsapp/client');

const app = createApp();

initWhatsapp(app);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Dashboard running at http://localhost:${port}`);
});
