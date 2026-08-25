const { getStoreSettings } = require('../lib/settings');

async function money(amount) {
  const { currencySymbol } = await getStoreSettings();
  return `${currencySymbol}${Number(amount).toFixed(2)}`;
}

function cartTotal(cart) {
  return cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

async function formatCart(cart) {
  if (!cart.length) return 'Your cart is empty.';
  const lines = await Promise.all(
    cart.map(async (line, i) => `${i + 1}. ${line.name} x${line.quantity} - ${await money(line.price * line.quantity)}`)
  );
  lines.push('', `*Total: ${await money(cartTotal(cart))}*`);
  return lines.join('\n');
}

module.exports = { money, cartTotal, formatCart };
