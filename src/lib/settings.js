const prisma = require('./prisma');

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

module.exports = { getStoreSettings, setStoreSettings };
