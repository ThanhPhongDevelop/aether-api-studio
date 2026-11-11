import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { bearer, issuePaths } from '../helpers/auth.js';
import { createUser, resetDatabase } from '../helpers/db.js';

const app = createApp({ metricsRecorder: null });

let admin: Awaited<ReturnType<typeof createUser>>;
let member: Awaited<ReturnType<typeof createUser>>;
const ids: Record<string, number> = {};

const seed = [
  { name: 'Nebula Headphones', slug: 'nebula-headphones', price: 249, stock: 5, category: 'Audio', rating: 4.7 },
  { name: 'Zenith Earbuds', slug: 'zenith-earbuds', price: 139, stock: 0, category: 'Audio', rating: 4.5 },
  { name: 'Photon Monitor', slug: 'photon-monitor', price: 429, stock: 3, category: 'Displays', rating: 4.6 },
  {
    name: 'Legacy Gamepad',
    slug: 'legacy-gamepad',
    price: 19.99,
    stock: 1,
    category: 'Gaming',
    rating: 3.1,
    isActive: false,
  },
];

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ role: 'ADMIN' });
  member = await createUser();
  for (const product of seed) {
    const row = await prisma.product.create({
      data: { ...product, description: `${product.name} — wireless edition`, createdById: admin.id },
    });
    ids[product.slug] = row.id;
  }
});

const names = (res: { body: { data: Array<{ name: string }> } }) => res.body.data.map((product) => product.name);

describe('GET /api/products', () => {
  it('lists active products publicly with pagination', async () => {
    const res = await request(app).get('/api/products?limit=2&sort=name').expect(200);
    expect(names(res)).toEqual(['Nebula Headphones', 'Photon Monitor']);
    expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(res.body.data[0].createdBy).toEqual({ id: admin.id, name: admin.name });
  });

  it('supports search, category, price range, stock and sorting', async () => {
    expect(names(await request(app).get('/api/products?search=zenith').expect(200))).toEqual(['Zenith Earbuds']);
    expect(names(await request(app).get('/api/products?category=Audio&sort=-price').expect(200))).toEqual([
      'Nebula Headphones',
      'Zenith Earbuds',
    ]);
    expect(names(await request(app).get('/api/products?minPrice=200&maxPrice=300').expect(200))).toEqual([
      'Nebula Headphones',
    ]);
    expect(names(await request(app).get('/api/products?inStock=false').expect(200))).toEqual(['Zenith Earbuds']);
  });

  it('shows inactive products to admins only', async () => {
    const asAdmin = await request(app)
      .get('/api/products?status=inactive')
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(names(asAdmin)).toEqual(['Legacy Gamepad']);
    const asMember = await request(app)
      .get('/api/products?status=all')
      .set('Authorization', bearer(member))
      .expect(200);
    expect(asMember.body.meta.total).toBe(3);
  });

  it('validates the query string', async () => {
    const fields = await request(app).get('/api/products?page=0&sort=price;drop&inStock=maybe').expect(400);
    expect(issuePaths(fields)).toEqual(expect.arrayContaining(['query.page', 'query.sort', 'query.inStock']));
    const range = await request(app).get('/api/products?minPrice=500&maxPrice=100').expect(400);
    expect(issuePaths(range)).toEqual(['query.minPrice']);
  });

  it('rejects an invalid token even on public endpoints', async () => {
    await request(app).get('/api/products').set('Authorization', 'Bearer garbage').expect(401);
  });
});

describe('GET /api/products/categories and /:id', () => {
  it('counts active products per category', async () => {
    const res = await request(app).get('/api/products/categories').expect(200);
    expect(res.body.data).toEqual([
      { name: 'Audio', count: 2 },
      { name: 'Displays', count: 1 },
    ]);
  });

  it('returns a product, hides inactive ones from the public and 404s unknown ids', async () => {
    await request(app).get(`/api/products/${ids['photon-monitor']}`).expect(200);
    await request(app).get(`/api/products/${ids['legacy-gamepad']}`).expect(404);
    await request(app).get(`/api/products/${ids['legacy-gamepad']}`).set('Authorization', bearer(admin)).expect(200);
    const missing = await request(app).get('/api/products/987654').expect(404);
    expect(missing.body.error.message).toBe('Product not found');
    await request(app).get('/api/products/not-a-number').expect(400);
  });
});

describe('POST /api/products', () => {
  const valid = { name: 'Helix Numpad', price: 49.5, category: 'Accessories' };

  it('creates a product with defaults and a unique slug', async () => {
    const first = await request(app).post('/api/products').set('Authorization', bearer(admin)).send(valid).expect(201);
    expect(first.body.data).toMatchObject({
      slug: 'helix-numpad',
      stock: 0,
      currency: 'USD',
      isActive: true,
      description: null,
    });
    const second = await request(app).post('/api/products').set('Authorization', bearer(admin)).send(valid).expect(201);
    expect(second.body.data.slug).toBe('helix-numpad-2');
  });

  it('reports missing and invalid fields', async () => {
    const missing = await request(app)
      .post('/api/products')
      .set('Authorization', bearer(admin))
      .send({ name: 'X' })
      .expect(400);
    expect(issuePaths(missing)).toEqual(expect.arrayContaining(['body.name', 'body.price', 'body.category']));

    const invalid = await request(app)
      .post('/api/products')
      .set('Authorization', bearer(admin))
      .send({ ...valid, price: 10.999, stock: -1, rating: 9, imageUrl: 'ftp://files/x.png', currency: 'dollars' })
      .expect(400);
    expect(issuePaths(invalid)).toEqual(
      expect.arrayContaining(['body.price', 'body.stock', 'body.rating', 'body.imageUrl', 'body.currency']),
    );
  });

  it('requires an admin token', async () => {
    await request(app).post('/api/products').send(valid).expect(401);
    await request(app).post('/api/products').set('Authorization', bearer(member)).send(valid).expect(403);
  });
});

describe('PUT, PATCH and DELETE /api/products/:id', () => {
  it('replaces a product and regenerates the slug when the name changes', async () => {
    const res = await request(app)
      .put(`/api/products/${ids['photon-monitor']}`)
      .set('Authorization', bearer(admin))
      .send({ name: 'Photon Monitor Pro', price: 499, category: 'Displays' })
      .expect(200);
    expect(res.body.data).toMatchObject({ slug: 'photon-monitor-pro', price: 499, stock: 0 });
  });

  it('patches individual fields and rejects empty patches', async () => {
    const res = await request(app)
      .patch(`/api/products/${ids['zenith-earbuds']}`)
      .set('Authorization', bearer(admin))
      .send({ stock: 42 })
      .expect(200);
    expect(res.body.data).toMatchObject({ stock: 42, price: 139 });
    await request(app)
      .patch(`/api/products/${ids['zenith-earbuds']}`)
      .set('Authorization', bearer(admin))
      .send({})
      .expect(400);
  });

  it('deletes products and 404s afterwards', async () => {
    await request(app)
      .delete(`/api/products/${ids['zenith-earbuds']}`)
      .set('Authorization', bearer(member))
      .expect(403);
    const res = await request(app)
      .delete(`/api/products/${ids['zenith-earbuds']}`)
      .set('Authorization', bearer(admin))
      .expect(200);
    expect(res.body.data.deleted).toBe(true);
    await request(app).delete(`/api/products/${ids['zenith-earbuds']}`).set('Authorization', bearer(admin)).expect(404);
  });
});
