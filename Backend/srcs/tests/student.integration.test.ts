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

describe('Student Routes', () => {
  beforeAll(async () => {
    await login();
  });

  afterAll(async () => {
    httpServer.close();
  });

  it('should be case-insensitive for search route', async () => {
    const res = await request(server)
      .get('/api/v1/students/Search?q=test')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
