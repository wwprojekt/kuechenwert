/**
 * Playwright Global Teardown
 * Runs after all tests
 */

async function globalTeardown() {
  console.log('🧹 Starting E2E test teardown...');

  // Clean up any test data or resources
  // For example, delete test users or reset database state

  console.log('✅ E2E test teardown completed');
}

export default globalTeardown;
