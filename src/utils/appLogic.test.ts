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
