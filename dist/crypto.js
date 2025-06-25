import * as crypto from 'crypto';
const ALGORITHM = 'aes-256-cbc';
const SALT = 'mcp-email-salt';
export function encrypt(text, key) {
    const derivedKey = crypto.scryptSync(key, SALT, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, derivedKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}
export function decrypt(encryptedText, key) {
    const derivedKey = crypto.scryptSync(key, SALT, 32);
    const [, encrypted] = encryptedText.split(':');
    const decipher = crypto.createDecipher(ALGORITHM, derivedKey);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
//# sourceMappingURL=crypto.js.map