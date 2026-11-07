import type { Request, Response, NextFunction } from 'express';
import { getAdminProjectId } from './firebaseAdmin.ts';
import { verifyFirebaseTokenSafely } from './tokenVerifier.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: 'admin' | 'writer' | string;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Express middleware to enforce role-based access control via Firebase Custom Claims.
 * Validates ID token, verifies email verification status, checks revocation, and enforces required roles.
 * 
 * Maps rejections to standard status codes and error code strings:
 * - no_token (401)
 * - token_expired (401)
 * - token_revoked (401)
 * - invalid_token (401)
 * - auth_backend_error (503)
 * - email_not_verified (403)
 * - no_role (403)
 * - forbidden (403)
 * 
 * Logs: [auth] <code> <method> <path> hasHeader=<bool> projectId=<value> firebaseErrorCode=<error.code>
 * 
 * @param allowed Roles permitted to access the route (e.g. 'admin', 'writer')
 */
export function requireRole(...allowed: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const hasHeader = Boolean(authHeader);
    const method = req.method;
    const path = req.originalUrl || req.url;
    const projectId = getAdminProjectId();

    // Safe logger helper: NEVER logs token, full email, or DB url
    const reject = (status: number, code: string, message: string, fbErrorCode: string = 'none') => {
      console.warn(`[auth] ${code} ${method} ${path} hasHeader=${hasHeader} projectId=${projectId} firebaseErrorCode=${fbErrorCode}`);
      return res.status(status).json({
        success: false,
        error: message,
        code
      });
    };

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reject(401, 'no_token', 'Unauthorized: Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return reject(401, 'no_token', 'Unauthorized: Empty Bearer token');
    }

    let decoded: any;
    try {
      decoded = await verifyFirebaseTokenSafely(token);
    } catch (err: any) {
      const fbCode = err?.code || '';
      const errMsg = String(err?.message || '');

      if (fbCode === 'auth/id-token-expired') {
        return reject(401, 'token_expired', 'Unauthorized: Token expired. Please refresh token.', fbCode);
      }

      if (fbCode === 'auth/id-token-revoked') {
        return reject(401, 'token_revoked', 'Unauthorized: Session revoked. Please sign in again.', fbCode);
      }

      const isArgumentOrAudience =
        fbCode === 'auth/argument-error' ||
        fbCode === 'auth/invalid-id-token' ||
        fbCode === 'auth/id-token-issuer-error' ||
        fbCode === 'auth/id-token-audience-error' ||
        fbCode === 'auth/project-id-not-found' ||
        errMsg.toLowerCase().includes('audience') ||
        errMsg.toLowerCase().includes('issuer') ||
        errMsg.toLowerCase().includes('project id');

      if (isArgumentOrAudience) {
        return reject(401, 'invalid_token', 'Unauthorized: Invalid authentication credentials', fbCode || 'invalid_token');
      }

      // Any other backend error
      return reject(503, 'auth_backend_error', 'Service Unavailable: Authentication backend service error', fbCode || 'auth_backend_error');
    }

    // Security requirement: email_verified MUST be strictly true
    if (decoded.email_verified !== true) {
      return reject(403, 'email_not_verified', 'Forbidden: Email address must be verified');
    }

    // Role claim requirement: user must have a role claim strictly from the verified token
    const role = (decoded.role as string) || '';
    if (!role) {
      return reject(403, 'no_role', 'Forbidden: Your account has no admin role yet');
    }

    // Role permission check: must be in allowed list
    if (!allowed.includes(role)) {
      return reject(403, 'forbidden', 'Forbidden: Insufficient role permissions');
    }

    // Attach authenticated user identity to request
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: role,
      name: decoded.name || decoded.displayName || undefined
    };

    return next();
  };
}
