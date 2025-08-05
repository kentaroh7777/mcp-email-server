#!/usr/bin/env node

import dotenv from 'dotenv';
import { encrypt } from '../src/utils/crypto.js';
import * as readline from 'readline';

dotenv.config();

async function getPasswordInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // パスワード入力時にエコーを無効にする
  const query = (q: string) => new Promise<string>(resolve => {
    rl.question(q, (answer) => {
      resolve(answer);
    });
    (rl.history as any) = (rl.history || []).slice(1); // 履歴に残さない
    (rl as any)._writeToOutput = (c: string) => { // 入力文字を非表示
      if (c !== '\n' && c !== '\r') {
        rl.output.write('*'); // 代わりにアスタリスクを表示
      } else {
        rl.output.write(c);
      }
    };
  });

  const password = await query(prompt);
  rl.close();
  return password.trim(); // 改行文字を除去
}

async function main() {
  console.log('=== Password Encryption Tool ===');
  console.log('');

  const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;

  if (!encryptionKey || encryptionKey === 'your-very-secure-encryption-key-change-this') {
    console.log('❌ Error: EMAIL_ENCRYPTION_KEY not configured in .env file');
    console.log('');
    console.log('Please set a secure encryption key in your .env file:');
    console.log('EMAIL_ENCRYPTION_KEY=your-very-secure-encryption-key-change-this');
    console.log('');
    process.exit(1);
  }

  let password = '';
  if (process.argv.slice(2).length > 0) {
    password = process.argv.slice(2)[0];
    console.log('Using password from command line argument.');
  } else {
    console.log('Please enter the password to encrypt:');
    password = await getPasswordInput('Password: ');
  }

  try {
    const encryptedPassword = encrypt(password, encryptionKey);
    
    console.log('\n=== Password Encryption Result ===');
    console.log('');
    console.log('✅ Password encrypted successfully!');
    console.log('');
    console.log('Encrypted password:');
    console.log(encryptedPassword);
    console.log('');
    console.log('Add this to your .env file for your IMAP account (e.g., IMAP_PASSWORD_youraccount=...).');
    console.log('');
    process.exit(0);
  } catch (error: any) {
    console.log('❌ Error encrypting password:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);