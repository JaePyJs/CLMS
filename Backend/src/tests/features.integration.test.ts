import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { server, httpServer } from '../server';

let token = '';

async function login() {
  const res = await request(server)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123', rememberMe: false });
  expect(res.status).toBe(200);
  token = res.body?.accessToken || res.body?.token || '';
  expect(token).toBeTruthy();
}

describe('CLMS feature integration', () => {
  beforeAll(async () => {
    await login();
  });

  afterAll(async () => {
    httpServer.close();
  });

  it('ensures default sections and lists them', async () => {
    const create = await request(server)
      .post('/api/sections/ensure-defaults')
      .set('Authorization', `Bearer ${token}`);
    expect(create.status).toBe(200);
    const res = await request(server)
      .get('/api/sections')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });

  it('creates borrowing policy and computes due date', async () => {
    const create = await request(server)
      .post('/api/policies')
      .set('Authorization', `Bearer ${token}`)
      .send({ category: 'TEST_POLICY', loan_days: 3 });
    expect(create.status).toBe(201);
    const due = await request(server)
      .post('/api/policies/compute-due-date')
      .set('Authorization', `Bearer ${token}`)
      .send({
        checkoutDate: new Date().toISOString(),
        category: 'TEST_POLICY',
      });
    expect(due.status).toBe(200);
    expect(due.body?.data?.dueDate).toBeTruthy();
  });

  it('lists overdue fines endpoint', async () => {
    const res = await request(server)
      .get('/api/fines/overdue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('adds printing pricing and creates job', async () => {
    const price = await request(server)
      .post('/api/printing/pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ paper_size: 'SHORT', color_level: 'BW', price: 2 });
    expect([200, 201]).toContain(price.status);
    const job = await request(server)
      .post('/api/printing/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        student_id: 'S-0001',
        paper_size: 'SHORT',
        color_level: 'BW',
        pages: 2,
      });
    expect(job.status).toBe(201);
    expect(job.body?.data?.total_cost).toBeGreaterThan(0);
  });

  it('creates announcement and lists active', async () => {
    const create = await request(server)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Test',
        content: 'Hello',
        start_time: new Date().toISOString(),
      });
    expect(create.status).toBe(201);
    const active = await request(server).get('/api/announcements/active');
    expect(active.status).toBe(200);
    expect(Array.isArray(active.body.data)).toBe(true);
  });

  it('self-service check-in with sections works', async () => {
    const res = await request(server)
      .post('/api/self-service/check-in-with-sections')
      .set('Authorization', `Bearer ${token}`)
      .send({ scanData: 'BAR-0001', sectionCodes: ['LIBRARY_SPACE'] });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });
});
