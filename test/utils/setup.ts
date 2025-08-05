import dotenv from 'dotenv';
import { beforeAll, afterAll } from 'vitest';

// Load environment variables before tests
dotenv.config();

console.log('Current working directory in setup.ts:', process.cwd());
console.log('Environment variables in setup.ts:', process.env);

beforeAll(() => {
  // Ensure test environment
  process.env.EMAIL_ENCRYPTION_KEY = 'cec2d7a8efa85f0f32519f77ddc1f61e206384d245fca95d88031adc25e32adf';
});

afterAll(() => {
  // Cleanup if needed
}); 