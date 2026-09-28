import { expect, test } from './fixtures';

const REQUEST_PATHS = [
  { href: '/funnel/c', title: /Traumküche/ },
  { href: '/formular', title: /Küchenangebote/ },
  { href: '/funnel/b', title: /unterbieten/ },
];

const urlFor = (path: string) => new RegExp(`${path}(?:[/?#]|$)`);

test.describe('Startseite', () => {
  test('zeigt die Hauptüberschrift und die drei Anfragewege', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/KüchenWert/);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toContainText(/küche/i);

    const main = page.getByRole('main');
    for (const { href } of REQUEST_PATHS) {
      await expect(main.locator(`a[href="${href}"]`).filter({ visible: true }).first()).toBeVisible();
    }
  });

  for (const { href, title } of REQUEST_PATHS) {
    test(`Anfrageweg ${href} öffnet die passende Seite`, async ({ page }) => {
      await page.goto('/');

      await page.getByRole('main').locator(`a[href="${href}"]`).filter({ visible: true }).first().click();

      await expect(page).toHaveURL(urlFor(href));
      await expect(page).toHaveTitle(title);
    });
  }
});

test('/formular startet Funnel A mit der ersten Frage', async ({ page }) => {
  await page.goto('/formular');
  await expect(page.getByRole('heading', { name: 'Welche Form soll Ihre Küche haben?' })).toBeVisible();

  await page.getByRole('link', { name: 'Ohne Auswahl starten' }).click();

  await expect(page).toHaveURL(urlFor('/funnel/a/kuechenform'));
  await expect(page.getByRole('heading', { level: 1, name: 'Welche Küchenform wünschen Sie sich?' })).toBeVisible();
});

test('/projekt zeigt das Formular für den Projektlink', async ({ page }) => {
  await page.goto('/projekt');

  await expect(page.getByRole('heading', { level: 1, name: 'Mein Küchenprojekt' })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByLabel('E-Mail-Adresse')).toBeVisible();
  await expect(main.getByRole('button', { name: 'Link senden' })).toBeEnabled();
});

test('unbekannte Adresse zeigt die 404-Seite', async ({ page }) => {
  await page.goto('/diese-seite-gibt-es-nicht');

  await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
  await expect(page).toHaveTitle(/404/);
});
