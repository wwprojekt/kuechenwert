import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Jeder Funnel-Schritt passt ohne Scrollen auf den Bildschirm: Frage,
 * Antworten und „Weiter“ liegen im sichtbaren Bereich (über der mobilen
 * Leiste), vom iPhone SE mit Safari-Leisten bis zum Laptop. kw-planner wird
 * gemockt: Es entstehen weder Visualisierungen noch Leads.
 */

const VIEWPORTS = [
  { width: 375, height: 548 },
  { width: 390, height: 664 },
  { width: 1366, height: 657 },
];

const A_STEPS = ['kuechenform', 'stil', 'groesse', 'raum', 'farbe', 'arbeitsplatte', 'kochfeld', 'backofen', 'kuehlen', 'geraete', 'leistungen', 'kochstil', 'anlass', 'wohnsituation', 'entscheidung', 'zeitrahmen', 'budget', 'plz', 'name', 'kontakt'];
const B_STEPS = ['preis', 'leistungsumfang', 'unterlagen', 'hochladen', 'aenderungen', 'kuechenform', 'zeitrahmen', 'details', 'marke', 'fronten', 'griffe', 'arbeitsplatte', 'arbeitsplatte-name', 'geraete', 'spuele', 'spuele-marke', 'extras', 'notizen', 'zahlung', 'anzahlung', 'plz', 'name', 'kontakt'];
/** Zustand je Schritt; „aenderungen“ mit eingeblendetem Freitext, dem höchsten Stand des Schritts. */
const B_SEED: Record<string, object> = {
  hochladen: { offerDeliveryMethod: 'now' },
  aenderungen: { planChanges: 'changes' },
};
const C_PLAN = ['form', 'masse', 'foto', 'stil', 'qualitaet', 'fronten', 'farbe', 'griffe', 'arbeitsplatte', 'plattenfarbe', 'schraenke', 'spuele', 'geraeteklasse', 'kochen', 'abluft', 'geraete', 'extras', 'leistungen', 'wuensche', 'plz'];
const C_LEAD = ['zeitrahmen', 'budget', 'anlass', 'wohnsituation', 'name', 'kontakt'];

const TOKEN = `kw_${'a'.repeat(48)}`;
const RENDER = { id: '11111111-1111-4111-8111-111111111111', version: 1, status: 'pending', mode: 'text', variant_label: null, image_url: null, feedback: null };
const A_STATE = {
  answers: { kitchen_form: 'l', room_type: '', kitchen_size: '', kitchen_style: '', color_preference: '', worktop_category: '', cooktop_type: '', oven_placement: '', cooling: '', extra_appliances: [], cooking_style: '', purchase_reason: '', housing: '', decision_maker: '', timeframe: 'asap', budget_eur: 10000, postal_code: '30159' },
  contact: { salutation: '', first_name: 'Max', last_name: 'Muster', email: '', phone: '' },
};
const B_STATE = { existingOfferPriceEur: '18000', offerDeliveryMethod: 'later', wantsDetails: 'ja' };
const plannerState = (step: string, lead: boolean) => ({
  step,
  sessionToken: lead ? TOKEN : null,
  postalCode: '30159',
  renders: lead ? [RENDER] : [],
  timeframe: '',
  submitted: false,
  offersRequested: false,
});

async function mockPlanner(page: Page) {
  await page.route('**/functions/v1/kw-planner', async (route: Route) => {
    const body = JSON.parse(route.request().postData() || '{}');
    const res =
      body.action === 'session'
        ? { session: { session_token: TOKEN, submitted: false, unlocked: false, offers_requested: false, config: {}, room: {}, estimate: null, photos: [], renders: [RENDER] } }
        : { status: 'pending', render_id: RENDER.id };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) });
  });
}

async function seed(page: Page, storage: 'session' | 'local', key: string, value: unknown) {
  await page.addInitScript(
    ({ storage, key, value }) => (storage === 'session' ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)),
    { storage, key, value },
  );
}

async function expectFits(page: Page) {
  const m = await page.evaluate(() => {
    const section = document.querySelector('main section');
    let bottom = 0;
    for (const el of section?.querySelectorAll('button, a, input, textarea, select, label, img, h1, p') ?? []) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width && r.height && cs.visibility !== 'hidden' && cs.display !== 'none') bottom = Math.max(bottom, r.bottom);
    }
    const bar = [...document.querySelectorAll<HTMLElement>('div.sticky.bottom-0')].find((d) => d.getBoundingClientRect().height > 0);
    const cta = [...document.querySelectorAll<HTMLElement>('.btn-primary-lg')].find((b) => b.getBoundingClientRect().height > 0);
    return {
      bottom,
      limit: Math.min(window.innerHeight, bar?.getBoundingClientRect().top ?? window.innerHeight),
      cta: cta?.getBoundingClientRect().bottom ?? Infinity,
      height: window.innerHeight,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(m.bottom, 'Frage und Antworten sichtbar').toBeLessThanOrEqual(m.limit + 1);
  expect(m.cta, '„Weiter“ sichtbar').toBeLessThanOrEqual(m.height + 1);
  expect(m.overflowX, 'kein seitliches Scrollen').toBeLessThanOrEqual(1);
}

for (const viewport of VIEWPORTS) {
  test.describe(`Ein Bildschirm pro Schritt (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport });
    test.beforeEach(({}, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Viewports sind fest vorgegeben');
    });

    for (const slug of A_STEPS) {
      test(`Funnel A: ${slug}`, async ({ page }) => {
        await seed(page, 'session', 'kw_funnel_a_v2', A_STATE);
        await page.goto(`/funnel/a/${slug}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectFits(page);
      });
    }

    for (const key of B_STEPS) {
      test(`Funnel B: ${key}`, async ({ page }) => {
        await seed(page, 'session', 'kw_funnel_b', { ...B_STATE, ...B_SEED[key] });
        await page.goto(`/funnel/b?schritt=${key}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expectFits(page);
      });
    }

    for (const step of [...C_PLAN, ...C_LEAD]) {
      test(`Funnel C: ${step}`, async ({ page }) => {
        const lead = C_LEAD.includes(step);
        if (lead) await mockPlanner(page);
        await seed(page, 'local', 'kw_planner_v2', plannerState(step, lead));
        await page.goto(`/funnel/c?schritt=${step}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // Die Budgetfrage zeigt ihre feste Skala in Euro, sonst erscheint vor dem Ergebnis kein Betrag.
        if (step !== 'budget') await expect(page.locator('main')).not.toContainText(/\d\s?€/);
        await expectFits(page);
      });
    }

    test('Startseite: alle drei Funnel-Buttons sofort sichtbar', async ({ page }) => {
      await page.goto('/');
      const buttons = page.getByRole('navigation', { name: 'Drei Wege zur neuen Küche' }).getByRole('link');
      await expect(buttons).toHaveCount(3);
      for (const box of await Promise.all((await buttons.all()).map((b) => b.boundingBox()))) {
        expect(box && box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
    });
  });
}
