/**
 * Authorization integration tests (supertest).
 *
 * Supabase is mocked by default. To run against a real test project instead,
 * set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY and replace the mock.module block below.
 */
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createAuthzTestSupabase } from '../helpers/mockSupabase.js';

const JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long!!';

process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL =
  process.env.TEST_SUPABASE_URL || 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key-for-authz-tests';

mock.module('../../config/supabase.js', {
  defaultExport: createAuthzTestSupabase({
    children: (filters) => {
      const childId = filters.find(([column]) => column === 'children_id')?.[1];
      if (String(childId) === '5') {
        return {
          data: { children_id: 5, parent_id: 'other-parent' },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  }),
  cache: true,
});

const { buildApp } = await import('../../app.js');
const app = buildApp();

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const parentToken = signToken({
  role: 'parent',
  parent_user_id: 'parent-1',
  email: 'parent@test.com',
});

const therapistToken = signToken({
  role: 'therapist',
  therapist_id: 'therapist-1',
  email: 'therapist@test.com',
});

describe('authorization', () => {
  it('rejects parent JWT on GET /api/users with 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${parentToken}`);
    assert.equal(res.status, 403);
  });

  it('rejects therapist JWT on another therapist caseload with 403', async () => {
    const res = await request(app)
      .get('/api/therapists/children/99999/profile')
      .set('Authorization', `Bearer ${therapistToken}`);
    assert.equal(res.status, 403);
  });

  it('rejects unauthenticated GET /api/children with 401', async () => {
    const res = await request(app).get('/api/children');
    assert.equal(res.status, 401);
  });

  it('rejects parent deleting another parent child with 403', async () => {
    const res = await request(app)
      .delete('/api/children/5')
      .set('Authorization', `Bearer ${parentToken}`);
    assert.equal(res.status, 403);
  });
});
