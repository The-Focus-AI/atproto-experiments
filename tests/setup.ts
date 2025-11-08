import { config } from 'dotenv';

// Load environment variables for tests
config();

// Global test configuration
export const TEST_CONFIG = {
  timeout: 30000,
  retries: 2,
};
