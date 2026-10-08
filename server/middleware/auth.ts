/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { getSqliteUserById, getSqliteUserByEmail } from '../../src/lib/sqlite-db';
import { config } from '../config';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_staff: boolean;
  is_superuser: boolean;
  email_verified: boolean;
  role: 'admin' | 'staff' | 'customer';
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: 'admin' | 'staff' | 'customer';
  is_staff: boolean;
  is_superuser: boolean;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function base64UrlEncode(strOrBuffer: string | Buffer): string {
  const buf = typeof strOrBuffer === 'string' ? Buffer.from(strOrBuffer, 'utf8') : strOrBuffer;
  return buf.toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Creates a cryptographically signed HMAC-SHA256 JWT
 */
export function createSignedToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresInSeconds: number = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', config.secrets.jwt)
    .update(dataToSign)
    .digest('base64url');

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies a signed HMAC-SHA256 JWT in constant time
 */
export function verifySignedToken<T extends JwtPayload = JwtPayload>(token: string): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', config.secrets.jwt)
      .update(dataToSign)
      .digest('base64url');

    const sigBuf = Buffer.from(signature, 'base64url');
    const expectedSigBuf = Buffer.from(expectedSignature, 'base64url');

    if (sigBuf.length !== expectedSigBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedSigBuf)) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as T;
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== 'number' || now >= payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createAccessToken(user: { id: string; email: string; username: string; is_staff?: boolean; is_superuser?: boolean; role?: 'admin' | 'staff' | 'customer' }): string {
  const role: 'admin' | 'staff' | 'customer' = user.is_superuser || user.is_staff || user.role === 'admin' ? 'admin' : (user.role || 'customer');
  return createSignedToken(
    {
      sub: String(user.id),
      email: user.email.toLowerCase().trim(),
      username: user.username,
      role,
      is_staff: Boolean(user.is_staff || user.is_superuser),
      is_superuser: Boolean(user.is_superuser),
      type: 'access',
    },
    86400 // 24 hours
  );
}

export function createRefreshToken(user: { id: string; email: string; username: string; is_staff?: boolean; is_superuser?: boolean; role?: 'admin' | 'staff' | 'customer' }): string {
  const role: 'admin' | 'staff' | 'customer' = user.is_superuser || user.is_staff || user.role === 'admin' ? 'admin' : (user.role || 'customer');
  return createSignedToken(
    {
      sub: String(user.id),
      email: user.email.toLowerCase().trim(),
      username: user.username,
      role,
      is_staff: Boolean(user.is_staff || user.is_superuser),
      is_superuser: Boolean(user.is_superuser),
      type: 'refresh',
    },
    604800 // 7 days
  );
}

export function getAuthTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) return token;
  }

  const customHeader = req.headers['x-auth-token'];
  if (customHeader && typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader && typeof cookieHeader === 'string') {
    const match = cookieHeader.match(/(?:access_token|auth_token|veloce_admin_token|veloce_auth_token|token|session)=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
  }

  return null;
}

export async function extractUserFromToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) return null;

  // Cryptographic token verification (Strict HMAC-SHA256 JWT)
  const payload = verifySignedToken(cleanToken);
  if (!payload || !payload.sub) {
    return null;
  }

  const user = await getSqliteUserById(payload.sub);
  if (!user) {
    // If not found by ID, try email from payload as fallback
    const userByEmail = await getSqliteUserByEmail(payload.email);
    if (!userByEmail) return null;
    return {
      id: userByEmail.id,
      username: userByEmail.username,
      email: userByEmail.email,
      first_name: userByEmail.first_name || '',
      last_name: userByEmail.last_name || '',
      phone: userByEmail.phone || '',
      is_staff: Boolean(userByEmail.is_staff),
      is_superuser: Boolean(userByEmail.is_superuser),
      email_verified: Boolean(userByEmail.email_verified),
      role: userByEmail.is_superuser || userByEmail.is_staff ? 'admin' : 'customer',
    };
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    phone: user.phone || '',
    is_staff: Boolean(user.is_staff),
    is_superuser: Boolean(user.is_superuser),
    email_verified: Boolean(user.email_verified),
    role: user.is_superuser || user.is_staff ? 'admin' : 'customer',
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please sign in.', code: 'UNAUTHORIZED' });
  }

  const user = await extractUserFromToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session token.', code: 'INVALID_TOKEN' });
  }

  req.user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = getAuthTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Administrative authentication required.', code: 'UNAUTHORIZED' });
  }

  const user = await extractUserFromToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session token.', code: 'INVALID_TOKEN' });
  }

  if (!user.is_staff && !user.is_superuser && user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Administrative privileges required.', code: 'FORBIDDEN' });
  }

  req.user = user;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getAuthTokenFromRequest(req);
  if (token) {
    try {
      const user = await extractUserFromToken(token);
      if (user) {
        req.user = user;
      }
    } catch (_) {}
  }
  next();
}

