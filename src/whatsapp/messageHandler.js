const prisma = require('../lib/prisma');
const { getStoreSettings, getNotificationNumbers } = require('../lib/settings');
const { getSession, saveSession, resetSession } = require('./session');
const { listCategories, listAvailableItems, listAvailableServices, findOrCreateCustomer } = require('./catalog');
const { money, cartTotal, formatCart } = require('./format');

const WELCOME =
  'Welcome to *{business}*! 🍽️\n\n' +
  'What would you like to do?\n' +
  '1) View our menu\n' +
  '2) View our catering services\n' +
  '3) View your cart\n\n' +
  'You can also type *cart*, *checkout* or *cancel* at any time.';

const ASK_CONTACT_INFO =
  'Before we continue - what\'s your name and the best contact number to reach you on?\n' +
  'e.g. "John Smith, 0821234567"';

async function welcomeText() {
  const { businessName } = await getStoreSettings();
  return WELCOME.replace('{business}', businessName);
}

async function formatCategoryList() {
  const categories = await listCategories();
  if (!categories.length) return 'Our menu is being updated, please check back soon!';
  const lines = categories.map((c, i) => `${i + 1}) ${c.name} (${c._count.items} items)`);
  return ['Choose a category by number:', ...lines, '', '0) Back to main menu'].join('\n');
}

async function formatItemList(categoryId) {
  const items = await listAvailableItems(categoryId);
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!items.length) return { text: 'No items available in this category right now.', items };
  const lines = await Promise.all(
    items.map(
      async (item, i) =>
        `${i + 1}) ${item.name} - ${await money(item.price)}${item.description ? `\n   _${item.description}_` : ''}`
    )
  );
  const text = [
    `*${category ? category.name : 'Menu'}*`,
    ...lines,
    '',
    'Reply with the item number to add 1 to your cart (e.g. "2"),',
    'or "<number> x<qty>" for a quantity (e.g. "2 x3").',
    '',
    '0) Back to categories',
  ].join('\n');
  return { text, items };
}

async function formatServiceList() {
  const services = await listAvailableServices();
  if (!services.length) return 'No services are listed right now, please check back soon!';
  const lines = await Promise.all(
    services.map(
      async (s, i) =>
        `${i + 1}) *${s.name}*${s.price ? ` - from ${await money(s.price)}` : ''}${s.description ? `\n   _${s.description}_` : ''}`
    )
  );
  return ['Choose a service to enquire about:', ...lines, '', '0) Back to main menu'].join('\n');
}

async function notifyAdmin(client, text) {
  const numbers = await getNotificationNumbers();
  await Promise.all(
    numbers.map(async (number) => {
      try {
        await client.sendMessage(`${number}@c.us`, text);
      } catch (err) {
        console.error(`Failed to notify ${number}:`, err.message);
      }
    })
  );
}

function parseItemSelection(raw, itemCount) {
  const match = raw.trim().match(/^(\d+)\s*(?:x\s*(\d+))?$/i);
  if (!match) return null;
  const index = Number(match[1]);
  const quantity = match[2] ? Number(match[2]) : 1;
  if (index < 1 || index > itemCount || quantity < 1) return null;
  return { index, quantity };
}

// Pulls a callable phone number (7+ digits, allowing spaces/dashes/brackets/+)
// out of free text, treating whatever's left over as the name.
function parseNameAndPhone(text) {
  const match = text.match(/(\+?\d[\d\s().-]{5,}\d)/);
  if (!match) return null;
  const digits = match[1].replace(/\D/g, '');
  if (digits.length < 7) return null;
  const name = text.replace(match[1], '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim() || null;
  return { name, phone: digits };
}

function describeCustomer(customer, chatId) {
  const number = customer.contactNumber || chatId;
  return customer.name ? `${customer.name} (${number})` : number;
}

async function handleMessage(client, message) {
  if (message.from === 'status@broadcast' || message.from.endsWith('@g.us')) return;

  // A real phone number for "@c.us" chats, but an opaque WhatsApp privacy id
  // for "@lid" chats - see the Customer model for why that distinction matters.
  const isRealNumber = message.from.endsWith('@c.us');
  const chatId = message.from.replace(/@c\.us$|@lid$/, '');
  const body = (message.body || '').trim();
  const lower = body.toLowerCase();

  const customer = await findOrCreateCustomer(chatId, isRealNumber);
  const session = await getSession(chatId);

  // Global commands available from (almost) any step.
  if (['hi', 'hello', 'hey', 'menu', 'start', 'help'].includes(lower)) {
    await resetSession(chatId);
    return message.reply(await welcomeText());
  }
  if (lower === 'cancel') {
    await resetSession(chatId);
    return message.reply('Your order has been cancelled. Type *menu* to start again.');
  }
  if (lower === 'cart') {
    return message.reply(await formatCart(session.cart));
  }
  if (lower === 'checkout' && !['CHECKOUT_NOTE', 'CHECKOUT_CONTACT'].includes(session.step)) {
    if (!session.cart.length) {
      return message.reply('Your cart is empty. Type *menu* to browse our menu first.');
    }
    if (!customer.contactNumber) {
      await saveSession(chatId, { step: 'CHECKOUT_CONTACT', categoryId: null, cart: session.cart });
      return message.reply(ASK_CONTACT_INFO);
    }
    await saveSession(chatId, { step: 'CHECKOUT_NOTE', categoryId: null, cart: session.cart });
    return message.reply(
      'Please share your event/delivery date, address and any notes for this order (or reply "skip").'
    );
  }

  switch (session.step) {
    case 'MAIN': {
      if (lower === '1') {
        await saveSession(chatId, { step: 'BROWSING_CATEGORIES', cart: session.cart });
        return message.reply(await formatCategoryList());
      }
      if (lower === '2') {
        await saveSession(chatId, { step: 'BROWSING_SERVICES', cart: session.cart });
        return message.reply(await formatServiceList());
      }
      if (lower === '3') {
        return message.reply(await formatCart(session.cart));
      }
      return message.reply(await welcomeText());
    }

    case 'BROWSING_CATEGORIES': {
      if (lower === '0') {
        await resetSession(chatId);
        return message.reply(await welcomeText());
      }
      const categories = await listCategories();
      const idx = Number(lower);
      const category = Number.isInteger(idx) ? categories[idx - 1] : null;
      if (!category) {
        return message.reply('Please reply with a valid category number.\n\n' + (await formatCategoryList()));
      }
      await saveSession(chatId, { step: 'BROWSING_ITEMS', categoryId: category.id, cart: session.cart });
      const { text } = await formatItemList(category.id);
      return message.reply(text);
    }

    case 'BROWSING_ITEMS': {
      if (lower === '0') {
        await saveSession(chatId, { step: 'BROWSING_CATEGORIES', cart: session.cart });
        return message.reply(await formatCategoryList());
      }
      const { text: itemListText, items } = await formatItemList(session.categoryId);
      const selection = parseItemSelection(body, items.length);
      if (!selection) {
        return message.reply('Sorry, I didn\'t understand that.\n\n' + itemListText);
      }
      const item = items[selection.index - 1];
      const cart = [...session.cart];
      const existing = cart.find((line) => line.menuItemId === item.id);
      if (existing) {
        existing.quantity += selection.quantity;
      } else {
        cart.push({ menuItemId: item.id, name: item.name, price: item.price, quantity: selection.quantity });
      }
      await saveSession(chatId, { step: 'BROWSING_ITEMS', categoryId: session.categoryId, cart });
      const { text } = await formatItemList(session.categoryId);
      return message.reply(
        `Added ${selection.quantity} x ${item.name} to your cart.\n\n${text}\n\nType *cart* to view your cart or *checkout* when ready.`
      );
    }

    case 'BROWSING_SERVICES': {
      if (lower === '0') {
        await resetSession(chatId);
        return message.reply(await welcomeText());
      }
      const services = await listAvailableServices();
      const idx = Number(lower);
      const service = Number.isInteger(idx) ? services[idx - 1] : null;
      if (!service) {
        return message.reply('Please reply with a valid service number.\n\n' + (await formatServiceList()));
      }
      if (!customer.contactNumber) {
        await saveSession(chatId, { step: 'SERVICE_CONTACT', categoryId: service.id, cart: session.cart });
        return message.reply(ASK_CONTACT_INFO);
      }
      await saveSession(chatId, { step: 'SERVICE_NOTE', categoryId: service.id, cart: session.cart });
      return message.reply(
        `Great choice! Please tell us more about your *${service.name}* enquiry (event date, guest count, location) or reply "skip".`
      );
    }

    case 'CHECKOUT_CONTACT':
    case 'SERVICE_CONTACT': {
      const parsed = parseNameAndPhone(body);
      if (!parsed) {
        return message.reply(
          'Sorry, I need a contact number with at least 7 digits. Please reply with your name and number, e.g. "John Smith, 0821234567".'
        );
      }
      await prisma.customer.update({
        where: { id: customer.id },
        data: { name: parsed.name, contactNumber: parsed.phone },
      });

      if (session.step === 'CHECKOUT_CONTACT') {
        await saveSession(chatId, { step: 'CHECKOUT_NOTE', categoryId: null, cart: session.cart });
        return message.reply(
          'Thanks! Please share your event/delivery date, address and any notes for this order (or reply "skip").'
        );
      }

      const service = await prisma.service.findUnique({ where: { id: session.categoryId } });
      await saveSession(chatId, { step: 'SERVICE_NOTE', categoryId: session.categoryId, cart: session.cart });
      return message.reply(
        `Thanks! Please tell us more about your *${service?.name}* enquiry (event date, guest count, location) or reply "skip".`
      );
    }

    case 'SERVICE_NOTE': {
      const serviceId = session.categoryId;
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      const note = lower === 'skip' ? null : body;

      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          type: 'SERVICE',
          serviceId,
          note,
          totalAmount: service?.price || 0,
          status: 'PENDING',
        },
      });

      await resetSession(chatId);
      await notifyAdmin(
        client,
        `New service enquiry #${order.id}\nService: ${service?.name}\nFrom: ${describeCustomer(customer, chatId)}\nNote: ${note || '-'}`
      );
      return message.reply(
        `Thank you! Your enquiry for *${service?.name}* has been received (reference #${order.id}). We'll be in touch soon.\n\nType *menu* to go back to the main menu.`
      );
    }

    case 'CHECKOUT_NOTE': {
      const note = lower === 'skip' ? null : body;
      const total = cartTotal(session.cart);

      const order = await prisma.order.create({
        data: {
          customerId: customer.id,
          type: 'MENU',
          note,
          totalAmount: total,
          status: 'PENDING',
          items: {
            create: session.cart.map((line) => ({
              menuItemId: line.menuItemId,
              quantity: line.quantity,
              priceAtSale: line.price,
            })),
          },
        },
      });

      await resetSession(chatId);
      await notifyAdmin(
        client,
        `New order #${order.id}\nFrom: ${describeCustomer(customer, chatId)}\nTotal: ${await money(total)}\nNote: ${note || '-'}\n\n${await formatCart(session.cart)}`
      );
      return message.reply(
        `Thank you! Your order #${order.id} for ${await money(total)} has been received. We'll confirm it with you shortly.\n\nType *menu* to place another order.`
      );
    }

    default: {
      await resetSession(chatId);
      return message.reply(await welcomeText());
    }
  }
}

module.exports = { handleMessage, welcomeText };
