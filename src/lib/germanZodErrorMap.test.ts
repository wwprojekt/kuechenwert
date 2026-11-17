import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { GANZE_ZAHL, germanZodErrorMap } from './germanErrors';

// Die Texte stammen aus zod 3 (globale Karte bis 17.11.2026). Der Vergleich zod 3 gegen zod 4 über
// alle Formularschemas ergab dieselben Meldungen; diese Fälle halten die Zuordnung der neuen
// Fallnamen (invalid_format, invalid_value, origin, input) fest.
const messages = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('germanZodErrorMap (zod 4)', () => {
  beforeAll(() => {
    z.config({ customError: germanZodErrorMap });
  });
  afterAll(() => {
    z.config({ customError: undefined });
  });

  it.each([
    ['Pflichtfeld', z.string(), undefined, 'Dieses Feld ist ein Pflichtfeld.'],
    ['null', z.number(), null, 'Dieses Feld ist ein Pflichtfeld.'],
    ['keine Zahl', z.coerce.number(), 'abc', 'Bitte geben Sie eine gültige Zahl ein.'],
    ['kein Text', z.string(), 5, 'Bitte geben Sie einen Text ein.'],
    ['keine Option', z.boolean(), 'ja', 'Bitte wählen Sie eine Option aus.'],
    ['anderer Typ', z.object({}), 'x', 'Ungültiger Wert. Erwartet: object.'],
    ['leer', z.string().min(1), '', 'Dieses Feld darf nicht leer sein.'],
    ['zu kurz', z.string().min(3), 'ab', 'Mindestens 3 Zeichen erforderlich.'],
    ['zu lang', z.string().max(2), 'abc', 'Maximal 2 Zeichen erlaubt.'],
    ['zu klein', z.number().min(5), 4, 'Der Wert muss mindestens 5 sein.'],
    ['zu groß', z.number().max(5), 6, 'Der Wert darf maximal 5 sein.'],
    ['zu wenige', z.array(z.string()).min(2), ['a'], 'Mindestens 2 Einträge erforderlich.'],
    ['zu viele', z.array(z.string()).max(1), ['a', 'b'], 'Maximal 1 Einträge erlaubt.'],
    ['E-Mail', z.string().email(), 'a@b', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'],
    ['URL', z.string().url(), 'keine url', 'Bitte geben Sie eine gültige URL ein.'],
    ['Muster', z.string().regex(/^\d+$/), 'x', 'Ungültiger Text.'],
    ['Auswahl', z.enum(['a', 'b']), 'c', 'Bitte wählen Sie einen gültigen Wert aus: a, b.'],
    ['Prüfung ohne Text', z.string().refine(() => false), 'x', 'Ungültige Eingabe.'],
    ['.int()', z.number().int(), 1.5, 'Ungültiger Wert. Erwartet: integer.'],
  ])('%s', (_name, schema, input, expected) => {
    expect(messages(schema, input)).toEqual([expected]);
  });

  it('eigene Meldungen gehen vor', () => {
    expect(messages(z.string().min(2, 'Bitte Namen angeben'), 'a')).toEqual(['Bitte Namen angeben']);
    expect(messages(z.literal(true, { error: 'Bitte akzeptieren' }), false)).toEqual(['Bitte akzeptieren']);
  });

  it('GANZE_ZAHL meldet wie .int() in zod 3 und prüft die Grenzen weiter', () => {
    const tage = z.coerce.number().refine(Number.isInteger, GANZE_ZAHL).min(1, 'Mindestens 1 Tag.').max(30, 'Höchstens 30 Tage.');
    expect(messages(tage, '0.5')).toEqual([GANZE_ZAHL, 'Mindestens 1 Tag.']);
    expect(messages(tage, '40.5')).toEqual([GANZE_ZAHL, 'Höchstens 30 Tage.']);
    // .int() meldete in zod 4 hier „maximal 9007199254740991“ vor der eigenen Grenze.
    expect(messages(tage, '491234567890123456')).toEqual(['Höchstens 30 Tage.']);
    expect(messages(tage, '7')).toEqual([]);
  });
});

describe('zod nur über src/lib/zod.ts', () => {
  const src = path.resolve(import.meta.dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : [],
    );

  it('kein Schema importiert "zod" direkt (sonst fehlen die deutschen Meldungen)', () => {
    const direct = files(src)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => /^import (?!type )[^;]*from ['"]zod['"]/m.test(readFileSync(f, 'utf8')))
      .map((f) => path.relative(src, f).split(path.sep).join('/'));
    expect(direct).toEqual(['lib/zod.ts']);
  });
});
