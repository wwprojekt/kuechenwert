/**
 * Playwright Global Setup
 * Runs before all tests
 */

import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');

  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the development server to be ready
    console.log('⏳ Waiting for dev server...');
    await page.goto('http://localhost:8080');
    await page.waitForSelector('body', { timeout: 30000 });
    
    console.log('✅ Dev server is ready');

    // You could add authentication setup here if needed
    // For example, create test users or set up test data

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ E2E test setup completed');
}

export default globalSetup;
