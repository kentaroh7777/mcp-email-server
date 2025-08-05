import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SALT = 'mcp-email-salt';

export function encrypt(text: string, key: string): string {
  const derivedKey = crypto.scryptSync(key, SALT, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string, key: string): string {
  const derivedKey = crypto.scryptSync(key, SALT, 32);
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}