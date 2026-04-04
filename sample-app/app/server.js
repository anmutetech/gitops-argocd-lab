const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Menu Data ───────────────────────────────────────────
const menu = [
  { id: 1, name: 'Classic Burger', category: 'Mains', price: 12.99, available: true, calories: 650, allergens: ['gluten', 'dairy'], prepTime: 12 },
  { id: 2, name: 'Caesar Salad', category: 'Starters', price: 9.49, available: true, calories: 320, allergens: ['gluten', 'dairy', 'eggs'], prepTime: 8 },
  { id: 3, name: 'Margherita Pizza', category: 'Mains', price: 14.99, available: true, calories: 800, allergens: ['gluten', 'dairy'], prepTime: 15 },
  { id: 4, name: 'Fish & Chips', category: 'Mains', price: 13.49, available: true, calories: 720, allergens: ['gluten', 'fish'], prepTime: 14 },
  { id: 5, name: 'Mango Smoothie', category: 'Beverages', price: 5.99, available: true, calories: 180, allergens: [], prepTime: 3 },
  { id: 6, name: 'Iced Latte', category: 'Beverages', price: 4.49, available: true, calories: 120, allergens: ['dairy'], prepTime: 2 },
  { id: 7, name: 'Chocolate Brownie', category: 'Desserts', price: 6.99, available: true, calories: 450, allergens: ['gluten', 'dairy', 'eggs', 'nuts'], prepTime: 5 },
  { id: 8, name: 'Grilled Chicken Wrap', category: 'Mains', price: 11.49, available: true, calories: 480, allergens: ['gluten'], prepTime: 10 },
  { id: 9, name: 'Sparkling Water', category: 'Beverages', price: 2.99, available: true, calories: 0, allergens: [], prepTime: 1 },
  { id: 10, name: 'Tiramisu', category: 'Desserts', price: 7.99, available: false, calories: 380, allergens: ['gluten', 'dairy', 'eggs'], prepTime: 5 },
];

const orders = [];

// ── Menu Endpoints ──────────────────────────────────────
app.get('/api/menu', (req, res) => {
  let items = [...menu];
  if (req.query.category) {
    items = items.filter(i => i.category.toLowerCase() === req.query.category.toLowerCase());
  }
  if (req.query.available === 'true') {
    items = items.filter(i => i.available);
  }
  res.json({ count: items.length, items });
});

app.get('/api/menu/:id', (req, res) => {
  const item = menu.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Menu item not found' });
  res.json(item);
});

// ── Order Endpoints ─────────────────────────────────────
app.post('/api/orders', (req, res) => {
  const { items, customerName, tableNumber } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item' });
  }
  if (!customerName) {
    return res.status(400).json({ error: 'customerName is required' });
  }

  const orderItems = [];
  let total = 0;
  for (const orderItem of items) {
    const menuItem = menu.find(i => i.id === orderItem.menuItemId);
    if (!menuItem) return res.status(400).json({ error: `Menu item ${orderItem.menuItemId} not found` });
    if (!menuItem.available) return res.status(400).json({ error: `${menuItem.name} is currently unavailable` });
    const qty = orderItem.quantity || 1;
    orderItems.push({ ...menuItem, quantity: qty, subtotal: menuItem.price * qty });
    total += menuItem.price * qty;
  }

  const order = {
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    customerName,
    tableNumber: tableNumber || null,
    items: orderItems,
    total: Math.round(total * 100) / 100,
    status: 'received',
    estimatedPrepTime: Math.max(...orderItems.map(i => i.prepTime)) + ' min',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  res.status(201).json(order);
});

app.get('/api/orders', (req, res) => {
  let list = [...orders];
  if (req.query.status) {
    list = list.filter(o => o.status === req.query.status);
  }
  res.json({ count: list.length, orders: list });
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.put('/api/orders/:id/status', (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const validTransitions = {
    received: ['preparing'],
    preparing: ['ready'],
    ready: ['served'],
    served: [],
  };
  const { status } = req.body;
  if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
    return res.status(400).json({ error: `Cannot transition from '${order.status}' to '${status}'` });
  }

  order.status = status;
  res.json(order);
});

// ── Health and Metrics ──────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'fresheats-menu-api',
    version: process.env.APP_VERSION || '1.0.0',
    hostname: require('os').hostname(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', async (req, res) => {
  const { register } = require('prom-client');
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`FreshEats Menu API running on port ${PORT}`);
  });
}

module.exports = app;
