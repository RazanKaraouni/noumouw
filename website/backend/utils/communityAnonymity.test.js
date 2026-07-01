import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANONYMOUS_DISPLAY_NAME,
  buildPublicAuthor,
  publicAuthorUserIds,
  sanitizePublicPost,
} from './communityAnonymity.js';

test('buildPublicAuthor hides identity when is_anonymous is true', () => {
  const author = buildPublicAuthor(
    { full_name: 'Jane Doe', profile_image_url: 'https://cdn.example/jane.jpg' },
    null,
    true,
  );

  assert.equal(author.display_name, ANONYMOUS_DISPLAY_NAME);
  assert.equal(author.profile_image_url, null);
  assert.equal(author.is_anonymous, true);
  assert.equal(author.role, 'parent');
});

test('buildPublicAuthor exposes parent profile when not anonymous', () => {
  const author = buildPublicAuthor(
    { full_name: 'Jane Doe', profile_image_url: 'https://cdn.example/jane.jpg' },
    null,
    false,
  );

  assert.equal(author.display_name, 'Jane Doe');
  assert.equal(author.profile_image_url, 'https://cdn.example/jane.jpg');
  assert.equal(author.is_anonymous, false);
});

test('sanitizePublicPost omits user_id for anonymous posts', () => {
  const post = {
    id: 'post-1',
    user_id: 'user-secret',
    is_anonymous: true,
    age_category: '0-2',
    content: 'Hello',
    hashtags: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    like_count: 0,
    comment_count: 0,
    is_liked: false,
    is_saved: false,
    specialist_responded: false,
  };

  const sanitized = sanitizePublicPost(post, buildPublicAuthor(null, null, true));

  assert.equal(sanitized.user_id, null);
  assert.equal(sanitized.author.display_name, ANONYMOUS_DISPLAY_NAME);
  assert.equal(sanitized.author.profile_image_url, null);
});

test('sanitizePublicPost keeps user_id for non-anonymous posts', () => {
  const post = {
    id: 'post-2',
    user_id: 'user-visible',
    is_anonymous: false,
    age_category: '0-2',
    content: 'Hello',
    hashtags: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    like_count: 1,
    comment_count: 0,
    is_liked: true,
    is_saved: false,
    specialist_responded: false,
  };

  const sanitized = sanitizePublicPost(
    post,
    buildPublicAuthor({ full_name: 'Sam', profile_image_url: null }, null, false),
  );

  assert.equal(sanitized.user_id, 'user-visible');
  assert.equal(sanitized.author.display_name, 'Sam');
});

test('publicAuthorUserIds excludes anonymous authors', () => {
  const ids = publicAuthorUserIds([
    { user_id: 'a', is_anonymous: false },
    { user_id: 'b', is_anonymous: true },
    { user_id: 'c', is_anonymous: false },
  ]);

  assert.deepEqual(ids.sort(), ['a', 'c']);
});
