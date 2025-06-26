#!/usr/bin/env node

import { encrypt } from '../dist/crypto.js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

function readPasswordHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    
    // rlを閉じてから独自の入力処理を開始
    rl.close();
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    
    const onData = function(char) {
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          process.exit(1);
          break;
        case '\u007f': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };
    
    process.stdin.on('data', onData);
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== XServer IMAP Account Setup ===');
console.log('This tool helps you set up XServer IMAP accounts.');
console.log('');
console.log('You need the following information from your XServer control panel:');
console.log('1. Server number (from "サーバー情報" - looks like sv1234, sv5678, etc.)');
console.log('2. Domain name (e.g., h-fpo.com, mydomain.com)');
console.log('3. Email username (e.g., info, contact, admin)');
console.log('4. Email password');
console.log('');

rl.question('Enter XServer server number (e.g., sv1234, sv5678): ', (serverNumber) => {
  // Validate server number format
  if (!serverNumber.match(/^sv\d+$/)) {
    console.error('Error: Server number must be in format "sv****" (e.g., sv1234)');
    process.exit(1);
  }

  rl.question('Enter domain (e.g., h-fpo.com, mydomain.com): ', (domain) => {
    rl.question('Enter email username (e.g., info, contact, admin): ', async (username) => {
      const password = await readPasswordHidden('Enter email password (hidden): ');
      
      if (!process.env.EMAIL_ENCRYPTION_KEY) {
        console.error('Error: EMAIL_ENCRYPTION_KEY not found in .env file');
        process.exit(1);
      }
      
      const encrypted = encrypt(password, process.env.EMAIL_ENCRYPTION_KEY);
      
      // Create identifier: username_domain_com
      const identifier = `${username}_${domain.replace(/[.-]/g, '_')}`;
      
      console.log('\n=== Configuration Generated ===');
      console.log('Add the following to your .env file:');
      console.log('');
      console.log(`# XServer account: ${username}@${domain}`);
      console.log(`XSERVER_SERVER_${identifier}=${serverNumber}`);
      console.log(`XSERVER_DOMAIN_${identifier}=${domain}`);
      console.log(`XSERVER_USERNAME_${identifier}=${username}`);
      console.log(`XSERVER_PASSWORD_${identifier}=${encrypted}`);
      console.log('');
      console.log('=== Account Details ===');
      console.log(`Email: ${username}@${domain}`);
      console.log(`IMAP Server: ${serverNumber}.xserver.jp`);
      console.log(`Port: 993 (SSL/TLS)`);
      console.log(`Identifier: ${identifier}`);
      console.log('');
      console.log('After adding to .env, test the connection with:');
      console.log(`node test-connection.js`);
      
      process.exit(0);
    });
  });
});
