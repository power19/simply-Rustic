const prisma = require('./prisma');

// Prefix shown before the amount, e.g. money(150) -> "$150.00" or "SRD 150.00".
// Not every currency has a clean single-glyph symbol (SRD notably doesn't, and
// reuses "$" elsewhere), so this is deliberately a display prefix, not a strict
// ISO symbol lookup. The settings page also allows a fully custom one.
const CURRENCY_OPTIONS = [
  { code: 'USD', prefix: '$' },
  { code: 'EUR', prefix: '€' },
  { code: 'GBP', prefix: '£' },
  { code: 'SRD', prefix: 'SRD ' },
  { code: 'ZAR', prefix: 'R' },
  { code: 'INR', prefix: '₹' },
];

const DEFAULTS = {
  businessName: () => process.env.BUSINESS_NAME || 'Simply Rustic Catering',
  currencySymbol: () => process.env.CURRENCY_SYMBOL || 'R',
};

async function getStoreSettings() {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(DEFAULTS) } } });
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const result = {};
  for (const key of Object.keys(DEFAULTS)) {
    result[key] = stored[key] ?? DEFAULTS[key]();
  }
  return result;
}

async function setStoreSettings({ businessName, currencySymbol }) {
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: 'businessName' },
      update: { value: businessName },
      create: { key: 'businessName', value: businessName },
    }),
    prisma.setting.upsert({
      where: { key: 'currencySymbol' },
      update: { value: currencySymbol },
      create: { key: 'currencySymbol', value: currencySymbol },
    }),
  ]);
}

async function getNotificationNumbers() {
  const rows = await prisma.notificationNumber.findMany({ orderBy: { createdAt: 'asc' } });
  if (rows.length > 0) return rows.map((row) => row.number);
  // Fall back to the .env value until someone adds a number via the Settings page.
  return process.env.ADMIN_WHATSAPP_NUMBER ? [process.env.ADMIN_WHATSAPP_NUMBER] : [];
}

function addNotificationNumber(number, label) {
  return prisma.notificationNumber.create({ data: { number, label: label || null } });
}

function removeNotificationNumber(id) {
  return prisma.notificationNumber.delete({ where: { id } }).catch(() => {});
}

module.exports = {
  getStoreSettings,
  setStoreSettings,
  CURRENCY_OPTIONS,
  getNotificationNumbers,
  addNotificationNumber,
  removeNotificationNumber,
};
