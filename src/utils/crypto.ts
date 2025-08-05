import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getKey(secretKey: string): Buffer {
  return crypto.scryptSync(secretKey, 'salt', 32);
}

export function encrypt(text: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('Encryption key is not set.');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(secretKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('Encryption key is not set.');
  }
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format.');
    }
    const [ivHex, encrypted] = parts;
    if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted text format: missing IV or data.');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const key = getKey(secretKey);
    console.log(`DEBUG DECRYPT: Key (hex)=${key.toString('hex')}, IV (hex)=${iv.toString('hex')}, Encrypted (hex)=${encrypted}`);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed. Check if the key is correct and the data is not corrupted.');
  }
}
