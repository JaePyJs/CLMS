import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../../app';

interface TestUser {
  id: string;
  username: string;
  password: string;
  role: string;
  expectedPermissions: string[];
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  cookieHeader: string;
}

class AuthTestHelper {
  private jwtSecret: string;
  private baseUrl: string;
  private tokenCache: Map<string, AuthTokens> = new Map();

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'test-secret-key';
    this.baseUrl = process.env.TEST_API_URL || 'http://localhost:3001';
  }

  /**
   * Get predefined test users
   */
  getTestUsers(): TestUser[] {
    return [
      {
        id: 'user-super-admin',
        username: 'superadmin',
        password: 'testpassword123',
        role: 'SUPER_ADMIN',
        expectedPermissions: [
          'USERS_CREATE', 'USERS_UPDATE', 'USERS_DELETE', 'USERS_VIEW',
          'STUDENTS_CREATE', 'STUDENTS_UPDATE', 'STUDENTS_DELETE', 'STUDENTS_VIEW',
          'BOOKS_CREATE', 'BOOKS_UPDATE', 'BOOKS_DELETE', 'BOOKS_VIEW',
          'EQUIPMENT_CREATE', 'EQUIPMENT_UPDATE', 'EQUIPMENT_DELETE', 'EQUIPMENT_VIEW',
          'ANALYTICS_VIEW', 'REPORTS_GENERATE', 'SYSTEM_ADMIN'
        ]
      },
      {
        id: 'user-admin',
        username: 'admin',
        password: 'testpassword123',
        role: 'ADMIN',
        expectedPermissions: [
          'STUDENTS_CREATE', 'STUDENTS_UPDATE', 'STUDENTS_VIEW',
          'BOOKS_CREATE', 'BOOKS_UPDATE', 'BOOKS_DELETE', 'BOOKS_VIEW',
          'EQUIPMENT_CREATE', 'EQUIPMENT_UPDATE', 'EQUIPMENT_DELETE', 'EQUIPMENT_VIEW',
          'ANALYTICS_VIEW', 'REPORTS_GENERATE'
        ]
      },
      {
        id: 'user-librarian',
        username: 'librarian',
        password: 'testpassword123',
        role: 'LIBRARIAN',
        expectedPermissions: [
          'STUDENTS_CREATE', 'STUDENTS_UPDATE', 'STUDENTS_VIEW',
          'BOOKS_CREATE', 'BOOKS_UPDATE', 'BOOKS_VIEW',
          'EQUIPMENT_VIEW', 'EQUIPMENT_ASSIGN',
          'ANALYTICS_VIEW'
        ]
      },
      {
        id: 'user-assistant',
        username: 'assistant',
        password: 'testpassword123',
        role: 'ASSISTANT',
        expectedPermissions: [
          'STUDENTS_VIEW',
          'BOOKS_VIEW',
          'EQUIPMENT_VIEW', 'EQUIPMENT_ASSIGN'
        ]
      },
      {
        id: 'user-viewer',
        username: 'viewer',
        password: 'testpassword123',
        role: 'VIEWER',
        expectedPermissions: [
          'STUDENTS_VIEW',
          'BOOKS_VIEW',
          'EQUIPMENT_VIEW'
        ]
      }
    ];
  }

  /**
   * Login as a test user and get tokens
   */
  async loginAs(username: string, password: string = 'testpassword123'): Promise<AuthTokens> {
    const cacheKey = `${username}:${password}`;

    // Check cache first
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username,
        password
      })
      .expect(200);

    const cookies = response.headers['set-cookie'] || [];
    const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');

    const tokens: AuthTokens = {
      accessToken: response.body.data?.accessToken || '',
      refreshToken: response.body.data?.refreshToken || '',
      cookieHeader
    };

    // Cache tokens for future use
    this.tokenCache.set(cacheKey, tokens);

    return tokens;
  }

  /**
   * Login as a specific test user role
   */
  async loginAsRole(role: string): Promise<AuthTokens> {
    const user = this.getTestUsers().find(u => u.role === role);
    if (!user) {
      throw new Error(`Test user with role ${role} not found`);
    }

    return this.loginAs(user.username, user.password);
  }

  /**
   * Create a mock JWT token for testing
   */
  createMockToken(payload: any, expiresIn: string = '1h'): string {
    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  /**
   * Create auth headers for requests
   */
  createAuthHeaders(tokens: AuthTokens): Record<string, string> {
    const headers: Record<string, string> = {};

    if (tokens.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    if (tokens.cookieHeader) {
      headers['Cookie'] = tokens.cookieHeader;
    }

    return headers;
  }

  /**
   * Make authenticated request
   */
  async authenticatedRequest(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    tokens: AuthTokens,
    data?: any,
    queryParams?: any
  ): Promise<request.Response> {
    const headers = this.createAuthHeaders(tokens);
    let req = request(app)[method](url);

    if (Object.keys(headers).length > 0) {
      req = req.set(headers);
    }

    if (queryParams) {
      req = req.query(queryParams);
    }

    if (data) {
      req = req.send(data);
    }

    return req;
  }

  /**
   * Test authentication with different roles
   */
  async testRoleBasedAccess(
    endpoint: string,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete' = 'get',
    data?: any,
    expectedPermissions: string[] = []
  ): Promise<{ results: any[], passed: boolean }> {
    const results: any[] = [];
    let passed = true;

    for (const user of this.getTestUsers()) {
      try {
        const tokens = await this.loginAs(user.username);
        const response = await this.authenticatedRequest(method, endpoint, tokens, data);

        const hasRequiredPermission = expectedPermissions.length === 0 ||
          user.expectedPermissions.some(perm => expectedPermissions.includes(perm));

        const expectedStatus = hasRequiredPermission ? 200 : 403;
        const actualPassed = response.status === expectedStatus;

        results.push({
          role: user.role,
          username: user.username,
          expectedStatus,
          actualStatus: response.status,
          passed: actualPassed,
          hasRequiredPermission,
          response: response.status === 200 ? 'Success' : response.body?.error || 'Access denied'
        });

        if (!actualPassed) {
          passed = false;
        }
      } catch (error: any) {
        results.push({
          role: user.role,
          username: user.username,
          error: error.message,
          passed: false
        });
        passed = false;
      }
    }

    return { results, passed };
  }

  /**
   * Test JWT token validation
   */
  async testTokenValidation(): Promise<{ results: any[], passed: boolean }> {
    const results: any[] = [];
    let passed = true;

    const tests = [
      {
        name: 'Valid token',
        token: this.createMockToken({ userId: 'user-super-admin', username: 'superadmin', role: 'SUPER_ADMIN' }),
        expectedStatus: 200
      },
      {
        name: 'Expired token',
        token: this.createMockToken({ userId: 'user-super-admin', username: 'superadmin', role: 'SUPER_ADMIN' }, '0s'),
        expectedStatus: 401
      },
      {
        name: 'Invalid token',
        token: 'invalid.jwt.token',
        expectedStatus: 401
      },
      {
        name: 'No token',
        token: null,
        expectedStatus: 401
      },
      {
        name: 'Malformed token',
        token: 'Bearer malformed.token',
        expectedStatus: 401
      }
    ];

    for (const test of tests) {
      try {
        const headers: Record<string, string> = {};
        if (test.token) {
          headers['Authorization'] = `Bearer ${test.token}`;
        }

        const response = await request(app)
          .get('/api/auth/me')
          .set(headers);

        const testPassed = response.status === test.expectedStatus;

        results.push({
          name: test.name,
          expectedStatus: test.expectedStatus,
          actualStatus: response.status,
          passed: testPassed,
          response: response.body?.error || response.body?.data?.user?.username || 'No response'
        });

        if (!testPassed) {
          passed = false;
        }
      } catch (error: any) {
        results.push({
          name: test.name,
          error: error.message,
          passed: false
        });
        passed = false;
      }
    }

    return { results, passed };
  }

  /**
   * Test login endpoint with various scenarios
   */
  async testLoginScenarios(): Promise<{ results: any[], passed: boolean }> {
    const results: any[] = [];
    let passed = true;

    const loginTests = [
      {
        name: 'Valid login - Super Admin',
        data: { username: 'superadmin', password: 'testpassword123' },
        expectedStatus: 200
      },
      {
        name: 'Valid login - Librarian',
        data: { username: 'librarian', password: 'testpassword123' },
        expectedStatus: 200
      },
      {
        name: 'Invalid username',
        data: { username: 'nonexistent', password: 'testpassword123' },
        expectedStatus: 401
      },
      {
        name: 'Invalid password',
        data: { username: 'superadmin', password: 'wrongpassword' },
        expectedStatus: 401
      },
      {
        name: 'Missing username',
        data: { password: 'testpassword123' },
        expectedStatus: 400
      },
      {
        name: 'Missing password',
        data: { username: 'superadmin' },
        expectedStatus: 400
      },
      {
        name: 'Empty credentials',
        data: { username: '', password: '' },
        expectedStatus: 400
      },
      {
        name: 'SQL injection attempt',
        data: { username: "admin'; DROP TABLE users; --", password: 'testpassword123' },
        expectedStatus: 401
      }
    ];

    for (const test of loginTests) {
      try {
        const response = await request(app)
          .post('/api/auth/login')
          .send(test.data);

        const testPassed = response.status === test.expectedStatus;

        results.push({
          name: test.name,
          expectedStatus: test.expectedStatus,
          actualStatus: response.status,
          passed: testPassed,
          response: response.body?.error || response.body?.message || response.body?.data?.user?.username || 'No response'
        });

        if (!testPassed) {
          passed = false;
        }
      } catch (error: any) {
        results.push({
          name: test.name,
          error: error.message,
          passed: false
        });
        passed = false;
      }
    }

    return { results, passed };
  }

  /**
   * Test refresh token functionality
   */
  async testRefreshToken(): Promise<{ results: any[], passed: boolean }> {
    const results: any[] = [];
    let passed = true;

    try {
      // First login to get tokens
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'superadmin', password: 'testpassword123' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] || [];
      const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');

      // Test refresh with valid token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader)
        .expect(200);

      results.push({
        name: 'Valid refresh token',
        expectedStatus: 200,
        actualStatus: refreshResponse.status,
        passed: refreshResponse.status === 200,
        hasNewAccessToken: !!refreshResponse.body.data?.accessToken
      });

      if (!refreshResponse.body.data?.accessToken) {
        passed = false;
      }

      // Test refresh without token
      const noTokenResponse = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      results.push({
        name: 'No refresh token',
        expectedStatus: 401,
        actualStatus: noTokenResponse.status,
        passed: noTokenResponse.status === 401
      });

    } catch (error: any) {
      results.push({
        name: 'Refresh token test error',
        error: error.message,
        passed: false
      });
      passed = false;
    }

    return { results, passed };
  }

  /**
   * Test logout functionality
   */
  async testLogout(): Promise<{ results: any[], passed: boolean }> {
    const results: any[] = [];
    let passed = true;

    try {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'superadmin', password: 'testpassword123' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] || [];
      const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');

      // Test logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookieHeader)
        .expect(200);

      results.push({
        name: 'Valid logout',
        expectedStatus: 200,
        actualStatus: logoutResponse.status,
        passed: logoutResponse.status === 200,
        message: logoutResponse.body?.message
      });

      // Test accessing protected endpoint after logout
      const protectedResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookieHeader)
        .expect(401);

      results.push({
        name: 'Access after logout',
        expectedStatus: 401,
        actualStatus: protectedResponse.status,
        passed: protectedResponse.status === 401
      });

    } catch (error: any) {
      results.push({
        name: 'Logout test error',
        error: error.message,
        passed: false
      });
      passed = false;
    }

    return { results, passed };
  }

  /**
   * Clear token cache
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
  }
}

export default AuthTestHelper;