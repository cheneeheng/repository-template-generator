import request from 'supertest';
import app from '../src/app.js';

describe('GET /items', () => {
  it('returns an empty array initially', async () => {
    const res = await request(app).get('/items');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /items', () => {
  it('creates an item', async () => {
    const res = await request(app).post('/items').send({ name: 'Widget' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Widget' });
  });

  it('rejects missing name', async () => {
    const res = await request(app).post('/items').send({});
    expect(res.status).toBe(400);
  });
});
