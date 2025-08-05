#!/usr/bin/env node

import dotenv from 'dotenv';
import { decrypt } from '../dist/crypto.js'; // distからインポート
import * as readline from 'readline';

dotenv.config();

async function getEncryptedTextInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>(resolve => {
    rl.question(prompt, resolve);
  });
  rl.close();
  return answer;
}

async function main() {
  console.log('=== Password Decryption Test Tool ===');
  console.log('');

  const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;

  if (!encryptionKey || encryptionKey === 'your-very-secure-encryption-key-change-this') {
    console.log('❌ Error: EMAIL_ENCRYPTION_KEY not configured in .env file or is default.');
    console.log('Please set a secure encryption key in your .env file.');
    process.exit(1);
  }

  let encryptedPassword = '';
  if (process.argv.slice(2).length > 0) {
    encryptedPassword = process.argv.slice(2)[0];
    console.log('Using encrypted text from command line argument.');
  } else {
    console.log('Please enter the encrypted text to decrypt:');
    encryptedPassword = await getEncryptedTextInput('Encrypted Text: ');
  }

  try {
    const decryptedPassword = decrypt(encryptedPassword, encryptionKey);
    
    console.log('\n=== Decryption Result ===');
    console.log('');
    console.log('✅ Decryption successful!');
    console.log('');
    console.log('Decrypted password:');
    console.log(decryptedPassword);
    console.log('');
    process.exit(0);
  } catch (error: any) {
    console.log('❌ Decryption failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
