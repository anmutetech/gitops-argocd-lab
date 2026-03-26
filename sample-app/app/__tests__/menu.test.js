const request = require('supertest');
const app = require('../server');

describe('Health Check', () => {
  it('GET /health returns healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('fresheats-menu-api');
  });
});

describe('Menu API', () => {
  it('GET /api/menu returns all menu items', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(10);
  });

  it('GET /api/menu?category=Beverages filters by category', async () => {
    const res = await request(app).get('/api/menu?category=Beverages');
    expect(res.statusCode).toBe(200);
    res.body.items.forEach(item => {
      expect(item.category).toBe('Beverages');
    });
  });

  it('GET /api/menu?available=true filters unavailable items', async () => {
    const res = await request(app).get('/api/menu?available=true');
    expect(res.statusCode).toBe(200);
    res.body.items.forEach(item => {
      expect(item.available).toBe(true);
    });
  });

  it('GET /api/menu/:id returns a single item', async () => {
    const res = await request(app).get('/api/menu/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Classic Burger');
  });

  it('GET /api/menu/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/menu/999');
    expect(res.statusCode).toBe(404);
  });
});

describe('Orders API', () => {
  it('POST /api/orders creates an order', async () => {
    const res = await request(app).post('/api/orders').send({
      customerName: 'Alice',
      tableNumber: 5,
      items: [{ menuItemId: 1, quantity: 2 }, { menuItemId: 5, quantity: 1 }],
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.customerName).toBe('Alice');
    expect(res.body.status).toBe('received');
    expect(res.body.total).toBeCloseTo(31.97);
    expect(res.body.id).toMatch(/^ORD-/);
  });

  it('POST /api/orders rejects empty items', async () => {
    const res = await request(app).post('/api/orders').send({ customerName: 'Bob', items: [] });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/orders rejects unavailable items', async () => {
    const res = await request(app).post('/api/orders').send({
      customerName: 'Charlie',
      items: [{ menuItemId: 10 }],
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it('GET /api/orders returns orders list', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toBe(200);
    expect(res.body.orders).toBeInstanceOf(Array);
  });
});
