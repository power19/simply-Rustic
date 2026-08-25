const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { handleMessage } = require('./messageHandler');

function initWhatsapp(app) {
  const state = { status: 'INITIALIZING', qrDataUrl: null, info: null };
  app.set('whatsappState', state);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr) => {
    state.status = 'QR';
    state.qrDataUrl = await qrcode.toDataURL(qr);
    console.log('Scan the QR code at /whatsapp in the dashboard, or below:');
    require('qrcode-terminal').generate(qr, { small: true });
  });

  client.on('ready', () => {
    state.status = 'READY';
    state.qrDataUrl = null;
    state.info = client.info;
    console.log('WhatsApp client is ready.');
  });

  client.on('authenticated', () => {
    state.status = 'AUTHENTICATED';
  });

  client.on('disconnected', (reason) => {
    state.status = 'DISCONNECTED';
    state.qrDataUrl = null;
    console.error('WhatsApp client disconnected:', reason);
  });

  client.on('message', (message) => {
    handleMessage(client, message).catch((err) => {
      console.error('Error handling WhatsApp message:', err);
    });
  });

  client.initialize();

  return client;
}

module.exports = { initWhatsapp };
