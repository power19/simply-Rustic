function money(amount) {
  const symbol = process.env.CURRENCY_SYMBOL || 'R';
  return `${symbol}${Number(amount).toFixed(2)}`;
}

function cartTotal(cart) {
  return cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

function formatCart(cart) {
  if (!cart.length) return 'Your cart is empty.';
  const lines = cart.map(
    (line, i) => `${i + 1}. ${line.name} x${line.quantity} - ${money(line.price * line.quantity)}`
  );
  lines.push('', `*Total: ${money(cartTotal(cart))}*`);
  return lines.join('\n');
}

module.exports = { money, cartTotal, formatCart };
