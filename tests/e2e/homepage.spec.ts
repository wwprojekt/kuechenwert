/**
 * Homepage E2E Tests
 * Tests for the main landing page functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/CaravanWert/);

    // Check main heading
    await expect(page.getByRole('heading', { name: /Wohnmobil verkaufen/ })).toBeVisible();

    // Check navigation
    await expect(page.getByRole('navigation')).toBeVisible();
    
    // Check main sections
    await expect(page.getByText(/Wie es funktioniert/)).toBeVisible();
    await expect(page.getByText(/Aktuelle Angebote/)).toBeVisible();
  });

  test('should navigate to selling page', async ({ page }) => {
    // Click on "Verkaufen" button in hero section
    await page.getByRole('button', { name: /Jetzt verkaufen/ }).first().click();
    
    // Should navigate to selling page
    await expect(page).toHaveURL(/\/verkaufen/);
    await expect(page.getByText(/Wohnmobil verkaufen/)).toBeVisible();
  });

  test('should navigate to buying page', async ({ page }) => {
    // Click on "Kaufen" navigation link
    await page.getByRole('link', { name: /Kaufen/ }).click();
    
    // Should navigate to buying page
    await expect(page).toHaveURL(/\/kaufen/);
  });

  test('should display motorhome listings', async ({ page }) => {
    // Wait for listings to load
    await page.waitForSelector('[data-testid="motorhome-listings"]', { timeout: 10000 });
    
    // Check if listings are displayed
    const listings = page.locator('[data-testid="motorhome-card"]');
    await expect(listings.first()).toBeVisible();
  });

  test('should open and close mobile navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Open mobile menu
    await page.getByRole('button', { name: /menu/i }).click();
    
    // Check mobile navigation is visible
    await expect(page.getByRole('navigation')).toBeVisible();
    
    // Close mobile menu
    await page.getByRole('button', { name: /close/i }).click();
    
    // Check mobile navigation is hidden
    await expect(page.getByRole('navigation')).toBeHidden();
  });

  test('should display footer with contact information', async ({ page }) => {
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check footer elements
    await expect(page.getByText(/CaravanWert/)).toBeVisible();
    await expect(page.getByText(/Kontakt/)).toBeVisible();
    
    // Check contact links
    await expect(page.locator('a[href^="mailto:"]')).toBeVisible();
    await expect(page.locator('a[href^="tel:"]')).toBeVisible();
  });

  test('should handle FAQ section', async ({ page }) => {
    // Find FAQ section
    const faqSection = page.getByText(/Häufig gestellte Fragen/);
    await expect(faqSection).toBeVisible();
    
    // Click on first FAQ item
    const firstFaq = page.locator('[data-testid="faq-item"]').first();
    await firstFaq.click();
    
    // Check if answer is revealed
    await expect(firstFaq.locator('[data-testid="faq-answer"]')).toBeVisible();
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 768, height: 1024 }, // iPad
      { width: 1920, height: 1080 }, // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Check that main elements are still visible and properly laid out
      await expect(page.getByRole('heading', { name: /Wohnmobil verkaufen/ })).toBeVisible();
      await expect(page.getByRole('navigation')).toBeVisible();
      
      // Check that buttons are clickable
      const sellButton = page.getByRole('button', { name: /Jetzt verkaufen/ }).first();
      await expect(sellButton).toBeVisible();
    }
  });
});
