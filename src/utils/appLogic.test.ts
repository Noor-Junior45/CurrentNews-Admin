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
