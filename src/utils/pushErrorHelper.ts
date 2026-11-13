export type FcmErrorCategory = 'stale_token' | 'iam_permission_denied' | 'token_failure';

export function classifyFcmError(errCode?: string, errMessage?: string): FcmErrorCategory {
  const code = String(errCode || '').trim();
  const msg = String(errMessage || '');

  if (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  ) {
    return 'stale_token';
  }

  if (
    code === 'messaging/third-party-auth-error' ||
    code === 'messaging/authentication-error' ||
    code === 'app/invalid-credential' ||
    /cloudmessaging\.messages\.create|permission_denied|permission\s+['"]?[^'"]+['"]?\s+denied/i.test(msg)
  ) {
    return 'iam_permission_denied';
  }

  return 'token_failure';
}
