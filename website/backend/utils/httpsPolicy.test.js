import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isHttpsUrl,
  parseCommaSeparatedUrls,
  validateProductionHttpsEnv,
} from './httpsPolicy.js';

describe('httpsPolicy', () => {
  it('isHttpsUrl accepts https only', () => {
    assert.equal(isHttpsUrl('https://api.example.com'), true);
    assert.equal(isHttpsUrl('http://api.example.com'), false);
    assert.equal(isHttpsUrl('not-a-url'), false);
  });

  it('parseCommaSeparatedUrls splits and trims', () => {
    assert.deepEqual(parseCommaSeparatedUrls(' https://a.com , https://b.com '), [
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('validateProductionHttpsEnv passes with valid production env', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_API_URL = 'https://api.example.com';
    process.env.SUPABASE_URL = 'https://xyz.supabase.co';
    process.env.CORS_ORIGINS = 'https://app.example.com';

    assert.deepEqual(validateProductionHttpsEnv(), []);

    process.env = prev;
  });

  it('validateProductionHttpsEnv rejects http origins', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_API_URL = 'http://api.example.com';
    process.env.SUPABASE_URL = 'https://xyz.supabase.co';
    process.env.CORS_ORIGINS = 'http://localhost:5173';

    const errors = validateProductionHttpsEnv();
    assert.ok(errors.some((e) => e.includes('PUBLIC_API_URL')));
    assert.ok(errors.some((e) => e.includes('CORS_ORIGINS')));

    process.env = prev;
  });
});
