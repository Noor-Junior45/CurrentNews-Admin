import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_SESSION_HINT_KEY,
  hasAuthSessionHint,
  setAuthSessionHint,
  clearAuthSessionHint,
  shouldRedirectRootToAdmin,
  getAuthGuardViewState,
} from './authSessionHint';
import {
  mergePublicationPages,
  applyOptimisticDeleteCount,
  applyOptimisticUpsertCount,
  parseArticlesCursor,
} from './publicationsHelper';
import { classifyFcmError } from './pushErrorHelper';
import { isValidPenName, normalizePenNameInput, resolveDraftAuthorName } from './penNameHelper';
import {
  MAX_ARTICLE_IMAGE_BYTES,
  normalizeAndValidateHttpsImageUrl,
  parseAndValidateBase64Image,
  sanitizeR2ArticleIdSegment,
} from './articleImageHelper';
import type { Post } from '../types';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

test('authSessionHint lifecycle works safely', () => {
  const storage = createMemoryStorage();
  assert.equal(hasAuthSessionHint(storage), false);

  setAuthSessionHint(storage);
  assert.equal(storage.getItem(AUTH_SESSION_HINT_KEY), '1');
  assert.equal(hasAuthSessionHint(storage), true);

  clearAuthSessionHint(storage);
  assert.equal(hasAuthSessionHint(storage), false);
});

test('shouldRedirectRootToAdmin skips login form when user or session hint exists', () => {
  assert.equal(shouldRedirectRootToAdmin({ hasCurrentUser: false, hasSessionHint: false }), false);
  assert.equal(shouldRedirectRootToAdmin({ hasCurrentUser: true, hasSessionHint: false }), true);
  assert.equal(shouldRedirectRootToAdmin({ hasCurrentUser: false, hasSessionHint: true }), true);
  assert.equal(shouldRedirectRootToAdmin({ hasCurrentUser: true, hasSessionHint: true }), true);
});

test('getAuthGuardViewState holds loading screen while claims hydrate even if user exists', () => {
  assert.equal(
    getAuthGuardViewState({ loading: true, hasUser: true, hasAdminPrivileges: false }),
    'loading'
  );
  assert.equal(
    getAuthGuardViewState({ loading: true, hasUser: false, hasAdminPrivileges: false }),
    'loading'
  );
  assert.equal(
    getAuthGuardViewState({ loading: false, hasUser: false, hasAdminPrivileges: false }),
    'unauthenticated'
  );
  assert.equal(
    getAuthGuardViewState({ loading: false, hasUser: true, hasAdminPrivileges: false }),
    'unauthorized'
  );
  assert.equal(
    getAuthGuardViewState({ loading: false, hasUser: true, hasAdminPrivileges: true }),
    'authorized'
  );
});

test('parseArticlesCursor preserves full article IDs containing underscores', () => {
  const parsed = parseArticlesCursor('1760000000123_post_1760000000000_f9a1b2c3');
  assert.deepEqual(parsed, {
    updatedAtMs: 1760000000123,
    id: 'post_1760000000000_f9a1b2c3',
  });
  assert.equal(parseArticlesCursor('invalid'), null);
  assert.equal(parseArticlesCursor('abc_post_1'), null);
  assert.equal(parseArticlesCursor('12345_'), null);
});

test('mergePublicationPages deduplicates pages and excludes archived records', () => {
  const p1 = { id: 'p1', title: 'One', status: 'published' } as Post;
  const p2 = { id: 'p2', title: 'Two', status: 'draft' } as Post;
  const p2Updated = { id: 'p2', title: 'Two Revised', status: 'draft' } as Post;
  const p3 = { id: 'p3', title: 'Three', status: 'archived' } as Post;

  const appended = mergePublicationPages([p1, p2], [p2Updated, p3], false);
  assert.deepEqual(appended.map((p) => p.id), ['p1', 'p2']);

  const replaced = mergePublicationPages([p1], [p2Updated, p3], true);
  assert.deepEqual(replaced.map((p) => p.id), ['p2']);
  assert.equal(replaced[0].title, 'Two Revised');
});

test('optimistic counts update accurately without going negative', () => {
  const base = { all: 10, published: 7, drafts: 3 };
  assert.deepEqual(applyOptimisticDeleteCount(base, 'published'), { all: 9, published: 6, drafts: 3 });
  assert.deepEqual(applyOptimisticDeleteCount(base, 'draft'), { all: 9, published: 7, drafts: 2 });
  assert.deepEqual(applyOptimisticDeleteCount({ all: 0, published: 0, drafts: 0 }, 'published'), {
    all: 0,
    published: 0,
    drafts: 0,
  });

  assert.deepEqual(applyOptimisticUpsertCount(base, 'published', null), {
    all: 11,
    published: 8,
    drafts: 3,
  });
  assert.deepEqual(applyOptimisticUpsertCount(base, 'published', 'draft'), {
    all: 10,
    published: 8,
    drafts: 2,
  });
});

test('classifyFcmError separates stale tokens from IAM permission denials', () => {
  assert.equal(
    classifyFcmError('messaging/registration-token-not-registered', 'Requested entity was not found.'),
    'stale_token'
  );
  assert.equal(
    classifyFcmError('messaging/invalid-registration-token', 'Invalid registration token.'),
    'stale_token'
  );
  assert.equal(
    classifyFcmError(
      'messaging/third-party-auth-error',
      "Permission 'cloudmessaging.messages.create' denied on resource '//cloudresourcemanager.googleapis.com/projects/gen-lang-client-0638643565'"
    ),
    'iam_permission_denied'
  );
  assert.equal(
    classifyFcmError(
      undefined,
      "Permission 'cloudmessaging.messages.create' denied on resource"
    ),
    'iam_permission_denied'
  );
  assert.equal(
    classifyFcmError('messaging/internal-error', 'Temporary backend timeout'),
    'token_failure'
  );
});

test('penNameHelper validates pen names and resolves writer/admin authors cleanly', () => {
  assert.equal(normalizePenNameInput('  Bureau Chief  '), 'Bureau Chief');
  assert.equal(isValidPenName('   '), false);
  assert.equal(isValidPenName('A'.repeat(101)), false);
  assert.equal(isValidPenName('A'.repeat(100)), true);

  // Non-admin writers always resolve to saved pen name even when editing another byline
  assert.equal(
    resolveDraftAuthorName({
      isAdminUser: false,
      savedPenName: 'Saved Writer Pen',
      displayName: 'Writer Display',
      existingPostAuthorName: 'Old Author',
      fallbackAuthor: 'Current News',
    }),
    'Saved Writer Pen'
  );

  // Admins default to saved pen name for new drafts
  assert.equal(
    resolveDraftAuthorName({
      isAdminUser: true,
      savedPenName: 'Admin Byline',
      displayName: 'Admin Real Name',
      fallbackAuthor: 'Current News',
    }),
    'Admin Byline'
  );

  // Admins fall back to displayName only when there is no saved pen name
  assert.equal(
    resolveDraftAuthorName({
      isAdminUser: true,
      savedPenName: null,
      displayName: 'Admin Real Name',
      fallbackAuthor: 'Current News',
    }),
    'Admin Real Name'
  );

  // Admins preserve existing post author while editing
  assert.equal(
    resolveDraftAuthorName({
      isAdminUser: true,
      savedPenName: 'Admin Byline',
      displayName: 'Admin Real Name',
      existingPostAuthorName: 'Field Correspondent',
      fallbackAuthor: 'Current News',
    }),
    'Field Correspondent'
  );
});

test('articleImageHelper validates allowed data:image MIMEs, 5MB cap, SVG rejection, and https URLs', () => {
  assert.equal(sanitizeR2ArticleIdSegment('../evil/id'), '___evil_id');
  assert.equal(sanitizeR2ArticleIdSegment('post_1715000000_ab12'), 'post_1715000000_ab12');

  const tinyPngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const validPng = parseAndValidateBase64Image(`data:image/png;base64,${tinyPngB64}`, 'image_url');
  assert.equal(validPng.ok, true);
  if (validPng.ok) {
    assert.equal(validPng.mime, 'image/png');
    assert.equal(validPng.ext, 'png');
    assert.ok(validPng.buffer.length > 0);
  }

  const validJpeg = parseAndValidateBase64Image(`data:image/jpeg;base64,${Buffer.from('jpegdata').toString('base64')}`, 'image_url');
  assert.equal(validJpeg.ok, true);
  if (validJpeg.ok) assert.equal(validJpeg.ext, 'jpg');

  const validWebp = parseAndValidateBase64Image(`data:image/webp;base64,${Buffer.from('webpdata').toString('base64')}`, 'image_url');
  assert.equal(validWebp.ok, true);
  if (validWebp.ok) assert.equal(validWebp.ext, 'webp');

  const svgRejected = parseAndValidateBase64Image(`data:image/svg+xml;base64,${Buffer.from('<svg></svg>').toString('base64')}`, 'image_url');
  assert.equal(svgRejected.ok, false);

  const gifRejected = parseAndValidateBase64Image(`data:image/gif;base64,${Buffer.from('GIF89a').toString('base64')}`, 'image_url');
  assert.equal(gifRejected.ok, false);

  const disguisedSvg = parseAndValidateBase64Image(`data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`, 'image_url');
  assert.equal(disguisedSvg.ok, false);

  const oversizedBuf = Buffer.alloc(MAX_ARTICLE_IMAGE_BYTES + 1, 1);
  const tooBig = parseAndValidateBase64Image(`data:image/jpeg;base64,${oversizedBuf.toString('base64')}`, 'image_url');
  assert.equal(tooBig.ok, false);

  assert.deepEqual(normalizeAndValidateHttpsImageUrl(''), { ok: true, url: '' });
  assert.deepEqual(normalizeAndValidateHttpsImageUrl('https://media.currentnews.blog/images/1/abc.webp', 'image_url'), {
    ok: true,
    url: 'https://media.currentnews.blog/images/1/abc.webp',
  });
  assert.equal(normalizeAndValidateHttpsImageUrl('http://example.com/a.jpg', 'image_url').ok, false);
  assert.equal(normalizeAndValidateHttpsImageUrl('javascript:alert(1)', 'image_url').ok, false);
  assert.equal(normalizeAndValidateHttpsImageUrl('data:text/html,<script>alert(1)</script>', 'image_url').ok, false);
  assert.equal(normalizeAndValidateHttpsImageUrl('/relative/path.jpg', 'image_url').ok, false);
});
