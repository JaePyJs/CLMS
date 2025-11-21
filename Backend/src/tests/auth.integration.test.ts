import request from 'supertest';
import { server as app } from '../server';

describe('Auth integration', () => {
  it('logs in with seeded admin and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123', rememberMe: true })
      .expect(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.accessToken).toBeTruthy();
    expect(res.body?.data?.user?.username).toBe('admin');
  });

  it('returns current user with valid token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123', rememberMe: true })
      .expect(200);
    const token = login.body?.data?.accessToken as string;
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body?.success).toBe(true);
    expect(me.body?.data?.username).toBe('admin');
  });
});
