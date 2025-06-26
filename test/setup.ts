import dotenv from 'dotenv';
import { beforeAll, afterAll } from 'vitest';

// Load environment variables before tests
dotenv.config();

beforeAll(() => {
  // Ensure test environment
  if (!process.env.EMAIL_ENCRYPTION_KEY) {
    // For tests, use a default key if not set
    process.env.EMAIL_ENCRYPTION_KEY = 'test-encryption-key-for-vitest-only';
  }
});

afterAll(() => {
  // Cleanup if needed
}); 