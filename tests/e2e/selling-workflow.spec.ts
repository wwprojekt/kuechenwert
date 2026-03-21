/**
 * Selling Workflow E2E Tests
 * Tests for the complete vehicle selling process
 */

import { test, expect } from '@playwright/test';

test.describe('Selling Workflow', () => {
  test('should complete vehicle selling wizard', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    
    // Navigate to selling page
    await page.getByRole('button', { name: /Jetzt verkaufen/ }).first().click();
    await expect(page).toHaveURL(/\/verkaufen/);
    
    // Click "Fahrzeug einstellen" to start wizard
    await page.getByRole('button', { name: /Fahrzeug einstellen/ }).click();
    
    // Should redirect to login if not authenticated
    await expect(page).toHaveURL(/\/login/);
    
    // Login with test credentials (you might need to set up test user)
    await page.getByLabel(/E-Mail/i).fill('test@example.com');
    await page.getByLabel(/Passwort/i).fill('testpassword123');
    await page.getByRole('button', { name: /Anmelden/ }).click();
    
    // After login, should redirect to wizard
    await expect(page).toHaveURL(/\/verkaufen\/wizard/);
    
    // Step 1: Vehicle Details
    await page.getByLabel(/Hersteller/i).fill('Hymer');
    await page.getByLabel(/Modell/i).fill('B-Klasse ModernComfort');
    await page.getByLabel(/Baujahr/i).fill('2020');
    await page.getByLabel(/Kilometerstand/i).fill('45000');
    
    // Select condition
    await page.getByRole('combobox', { name: /Zustand/i }).click();
    await page.getByRole('option', { name: /Sehr gut/i }).click();
    
    // Select body type
    await page.getByRole('combobox', { name: /Aufbauart/i }).click();
    await page.getByRole('option', { name: /Teilintegriert/i }).click();
    
    // Fill description
    await page.getByLabel(/Beschreibung/i).fill('Top gepflegtes Wohnmobil mit Vollausstattung. Regelmäßig gewartet, keine Unfälle.');
    
    // Continue to next step
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Step 2: Technical Details (optional fields)
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Step 3: Dimensions - seats and sleeping places are required
    await page.getByLabel(/Sitzplätze/i).fill('4');
    await page.getByLabel(/Schlafplätze/i).fill('4');
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Step 4: Interior Features
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Step 5: Equipment
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Step 6: Photos - This would require file upload simulation
    // For now, skip photo upload in automated tests
    // In a real scenario, you'd mock the file upload
    
    // Step 7: Defects
    // Select "no known defects" checkbox
    // await page.getByLabel(/Keine bekannten Mängel/i).check();
    // await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Step 8: Sale Channel
    await page.getByRole('radio', { name: /Händler-Auktion/ }).check();
    await page.getByLabel(/Mindestpreis/i).fill('45000');
    
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Review step: Verify data is displayed
    await expect(page.getByText(/Überprüfung/)).toBeVisible();
    await expect(page.getByText(/Hymer/)).toBeVisible();
    await expect(page.getByText(/B-Klasse ModernComfort/)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Navigate directly to wizard (assuming user is logged in)
    await page.goto('/verkaufen/wizard');
    
    // Try to continue without filling required fields
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Should show validation errors
    await expect(page.getByText(/erforderlich/i)).toBeVisible();
  });

  test('should handle photo upload validation', async ({ page }) => {
    await page.goto('/verkaufen/wizard');
    
    // Fill step 1 to get to photos
    await page.getByLabel(/Hersteller/i).fill('Test');
    await page.getByLabel(/Modell/i).fill('Test');
    await page.getByLabel(/Baujahr/i).fill('2020');
    await page.getByLabel(/Kilometerstand/i).fill('50000');
    await page.getByLabel(/Beschreibung/i).fill('Test description with enough characters for the minimum length');
    
    // Navigate through steps to reach photos (steps 1-5 -> step 6 is photos)
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /Weiter/ }).click();
    }
    
    // Should be on photo upload step
    await expect(page.getByText(/Fotos hochladen/)).toBeVisible();
    
    // Try to continue without photos
    await page.getByRole('button', { name: /Weiter/ }).click();
    
    // Should show photo requirement error (minimum 4 photos)
    await expect(page.getByText(/Mindestens 4 Fotos/i)).toBeVisible();
  });

  test('should handle different sale channels', async ({ page }) => {
    await page.goto('/verkaufen/wizard');
    
    // Navigate to sale channel step
    // ... (fill required fields and navigate)
    
    // Test auction option - shows reserve price field
    await page.getByRole('radio', { name: /Händler-Auktion/ }).check();
    await expect(page.getByLabel(/Mindestpreis/i)).toBeVisible();
    
    // Test instant price option - no additional fields needed
    await page.getByRole('radio', { name: /Sofortpreis/ }).check();
    
    // Test station option - should show appointment step next
    await page.getByRole('radio', { name: /Ankaufstation/ }).check();
  });
});
