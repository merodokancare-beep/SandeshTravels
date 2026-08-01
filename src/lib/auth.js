import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET || 'sandesh_travels_super_secret_session_key_12345';
const COOKIE_NAME = 'partner_session';

// Helper to derive a 256-bit key from our secret
function getEncryptionKey() {
  return crypto.createHash('sha256').update(SECRET).digest();
}

// Encrypt payload
export function encryptPayload(payload) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV and encrypted text joined by a colon
  return `${iv.toString('hex')}:${encrypted}`;
}

// Decrypt payload
export function decryptPayload(token) {
  try {
    const [ivHex, encryptedHex] = token.split(':');
    if (!ivHex || !encryptedHex) return null;
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (err) {
    console.error('Session decryption error:', err);
    return null;
  }
}

const ADMIN_COOKIE_NAME = 'admin_session';

// Get partner session from headers/cookies in server context
export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie) return null;
  
  return decryptPayload(sessionCookie.value);
}

// Set partner session cookie
export async function setSession(payload) {
  const token = encryptPayload(payload);
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
}

// Clear partner session cookie
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Get admin session from headers/cookies in server context
export async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_COOKIE_NAME);
  if (!sessionCookie) return null;
  
  return decryptPayload(sessionCookie.value);
}

// Set admin session cookie
export async function setAdminSession(payload) {
  const token = encryptPayload(payload);
  const cookieStore = await cookies();
  
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
}

// Clear admin session cookie
export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

