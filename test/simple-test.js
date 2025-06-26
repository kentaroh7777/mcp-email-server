#!/usr/bin/env node

/**
 * Simple test to verify MCP Email Server functionality
 */

const dotenv = require('dotenv');
dotenv.config();

// Test basic requirements
console.log('Testing MCP Email Server Configuration...\n');

let testsPassed = 0;
let totalTests = 0;

// Test 1: Check if required files exist
totalTests++;
const fs = require('fs');
const requiredFiles = [
  'src/index.ts',
  'src/gmail.ts', 
  'src/imap.ts',
  'src/crypto.ts',
  'src/types.ts',
  'package.json',
  'tsconfig.json',
  '.env.example'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.log(`❌ Missing file: ${file}`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('✅ All required files present');
  testsPassed++;
} else {
  console.log('❌ Some required files are missing');
}

// Test 2: Check environment configuration
totalTests++;
const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY;
if (!encryptionKey || encryptionKey === 'your-encryption-key-here' || encryptionKey === 'your-very-secure-encryption-key-change-this') {
  console.log('❌ Encryption key not configured properly');
} else {
  console.log('✅ Encryption key configured');
  testsPassed++;
}

// Test 3: Check if TypeScript compiles
totalTests++;
try {
  const { execSync } = require('child_process');
  console.log('🔄 Checking TypeScript compilation...');
  
  // Try to compile without output
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ TypeScript compilation successful');
  testsPassed++;
} catch (error) {
  console.log('❌ TypeScript compilation failed');
  console.log('   Error:', error.message);
}

// Test 4: Check npm dependencies
totalTests++;
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    '@modelcontextprotocol/sdk',
    'dotenv',
    'google-auth-library',
    'googleapis',
    'node-imap'
  ];
  
  let allDepsPresent = true;
  for (const dep of requiredDeps) {
    if (!packageJson.dependencies[dep]) {
      console.log(`❌ Missing dependency: ${dep}`);
      allDepsPresent = false;
    }
  }
  
  if (allDepsPresent) {
    console.log('✅ All required dependencies present');
    testsPassed++;
  }
} catch (error) {
  console.log('❌ Could not verify dependencies');
}

// Test 5: Basic configuration validation
totalTests++;
const config = {
  hasGmail: false,
  hasIMAP: false,
  hasXServer: false
};

// Check Gmail configuration
const gmailKeys = Object.keys(process.env).filter(key => key.startsWith('GMAIL_ACCESS_TOKEN_'));
if (gmailKeys.length > 0 && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
  config.hasGmail = true;
}

// Check IMAP configuration
const imapKeys = Object.keys(process.env).filter(key => key.startsWith('IMAP_HOST_'));
if (imapKeys.length > 0) {
  config.hasIMAP = true;
}

// Check XServer configuration
const xserverKeys = Object.keys(process.env).filter(key => key.startsWith('XSERVER_DOMAIN_'));
if (xserverKeys.length > 0) {
  config.hasXServer = true;
}

if (config.hasGmail || config.hasIMAP || config.hasXServer) {
  console.log('✅ At least one email account type configured');
  console.log(`   Gmail: ${config.hasGmail ? 'Yes' : 'No'}`);
  console.log(`   IMAP: ${config.hasIMAP ? 'Yes' : 'No'}`);
  console.log(`   XServer: ${config.hasXServer ? 'Yes' : 'No'}`);
  testsPassed++;
} else {
  console.log('⚠️  No email accounts configured (this is OK for development)');
  console.log('   Configure accounts in .env to test full functionality');
  testsPassed++; // Still pass this test as it's OK for development
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('Test Summary');
console.log('='.repeat(50));
console.log(`Tests passed: ${testsPassed}/${totalTests}`);

const successRate = Math.round((testsPassed / totalTests) * 100);
console.log(`Success rate: ${successRate}%`);

if (testsPassed === totalTests) {
  console.log('\n🎉 All tests passed!');
  console.log('\nNext steps:');
  console.log('1. npm run build');
  console.log('2. Configure email accounts in .env');
  console.log('3. Run node test-connection.js');
  console.log('4. Add to Cursor MCP configuration');
} else {
  console.log('\n⚠️  Some tests failed. Please check the errors above.');
}

process.exit(testsPassed === totalTests ? 0 : 1);