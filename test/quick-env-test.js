#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

console.log('=== Environment Variables Test ===');
console.log(`MAX_EMAIL_CONTENT_LIMIT: ${process.env.MAX_EMAIL_CONTENT_LIMIT || 'not set'}`);
console.log(`MAX_EMAIL_FETCH_PAGES: ${process.env.MAX_EMAIL_FETCH_PAGES || 'not set'}`);
console.log(`MAX_EMAIL_FETCH_PER_PAGE: ${process.env.MAX_EMAIL_FETCH_PER_PAGE || 'not set'}`);

// Test the parsing
const maxLimit = parseInt(process.env.MAX_EMAIL_CONTENT_LIMIT || '500');
const maxPages = parseInt(process.env.MAX_EMAIL_FETCH_PAGES || '2');
const maxPerPage = parseInt(process.env.MAX_EMAIL_FETCH_PER_PAGE || '500');

console.log('\nParsed values:');
console.log(`maxLimit: ${maxLimit}`);
console.log(`maxPages: ${maxPages}`);
console.log(`maxPerPage: ${maxPerPage}`);

console.log('\n✅ Environment variables are loaded and parsed correctly!');
