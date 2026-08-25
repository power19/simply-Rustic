const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { handleMessage } = require('./messageHandler');

function initWhatsapp(app) {
  const state = { status: 'INITIALIZING', qrDataUrl: null, info: null };
  app.set('whatsappState', state);

  // When a device links (fresh pairing or reconnect), WhatsApp Web replays the
  // account's message history so the session can sync. Without a cutoff, every
  // one of those historical messages looks like a brand-new incoming message
  // and gets auto-replied to - i.e. the bot blasts every past contact at once.
  // `readyCutoff` is reset to "now" each time the client becomes ready, and
  // `isReady` stays false until then, so nothing is processed until sync is done
  // and only messages that actually arrive after that point are handled.
  let isReady = false;
  let readyCutoff = Math.floor(Date.now() / 1000);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr) => {
    isReady = false;
    state.status = 'QR';
    state.qrDataUrl = await qrcode.toDataURL(qr);
    console.log('Scan the QR code at /whatsapp in the dashboard, or below:');
    require('qrcode-terminal').generate(qr, { small: true });
  });

  client.on('ready', () => {
    readyCutoff = Math.floor(Date.now() / 1000);
    isReady = true;
    state.status = 'READY';
    state.qrDataUrl = null;
    state.info = client.info;
    console.log('WhatsApp client is ready.');
  });

  client.on('authenticated', () => {
    state.status = 'AUTHENTICATED';
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    state.status = 'DISCONNECTED';
    state.qrDataUrl = null;
    console.error('WhatsApp client disconnected:', reason);
  });

  client.on('message', (message) => {
    if (!isReady) return;
    if (message.fromMe) return;
    if (typeof message.timestamp === 'number' && message.timestamp < readyCutoff) return;

    handleMessage(client, message).catch((err) => {
      console.error('Error handling WhatsApp message:', err);
    });
  });

  client.initialize();

  return client;
}

module.exports = { initWhatsapp };
