#!/usr/bin/env node

import dotenv from 'dotenv';
import { encrypt } from '../dist/crypto.js';

dotenv.config();

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('=== Password Encryption Tool ===');
  console.log('');
  console.log('Usage: node tools/encrypt-password.js <password>');
  console.log('');
  console.log('Example:');
  console.log('  node tools/encrypt-password.js "mySecretPassword123"');
  console.log('');
  console.log('The encrypted password can be used in .env file for IMAP accounts.');
  console.log('');
  process.exit(1);
}

const password = args[0];
const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;

if (!encryptionKey || encryptionKey === 'your-very-secure-encryption-key-change-this') {
  console.log('❌ Error: EMAIL_ENCRYPTION_KEY not configured in .env file');
  console.log('');
  console.log('Please set a secure encryption key in your .env file:');
  console.log('EMAIL_ENCRYPTION_KEY=your-very-secure-encryption-key-change-this');
  console.log('');
  process.exit(1);
}

try {
  const encryptedPassword = encrypt(password, encryptionKey);
  
  console.log('=== Password Encryption Result ===');
  console.log('');
  console.log('✅ Password encrypted successfully!');
  console.log('');
  console.log('Encrypted password:');
  console.log(encryptedPassword);
  console.log('');
  console.log('Add this to your .env file for your IMAP account.');
  console.log('');
} catch (error) {
  console.log('❌ Error encrypting password:', error.message);
  process.exit(1);
} 