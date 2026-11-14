import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserProfile, UserRole } from '../src/types/smartcity.ts';
import { getDb } from './db.ts';

const TOKEN_SECRET = process.env.SESSION_SECRET || 'smartcity-ai-innovex-2026-dev-secret';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, originalHash] = stored.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
}

export function signSessionToken(userId: string, role: UserRole): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      role,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { uid: string; role: UserRole; exp: number } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.uid || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  authUser?: UserProfile;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing bearer token.' });
  }
  const token = header.slice(7).trim();
  const decoded = verifySessionToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
  const db = getDb();
  const user = db.users.find((u) => u.id === decoded.uid && u.active);
  if (!user) {
    return res.status(401).json({ error: 'User account not found or deactivated.' });
  }
  const { passwordHash: _, ...profile } = user;
  req.authUser = profile;
  next();
}

export function requireRoles(...allowed: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowed.includes(req.authUser.role)) {
      return res.status(403).json({
        error: `Access denied for role "${req.authUser.role}". Required: ${allowed.join(', ')}.`,
      });
    }
    next();
  };
}
