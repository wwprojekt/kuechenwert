import { describe, it, expect } from 'vitest';
import { passwordSchema, emailSchema } from './validation';

function firstError(result: ReturnType<typeof passwordSchema.safeParse>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('passwordSchema', () => {
  it('accepts a password with all required character classes', () => {
    expect(passwordSchema.safeParse('Kueche#2026').success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(firstError(passwordSchema.safeParse('Ku#1a'))).toBe('Passwort muss mindestens 8 Zeichen lang sein');
  });

  it.each([
    ['kueche#2026', 'Mindestens ein Großbuchstabe erforderlich'],
    ['KUECHE#2026', 'Mindestens ein Kleinbuchstabe erforderlich'],
    ['Kueche#Wert', 'Mindestens eine Zahl erforderlich'],
    ['Kueche2026', 'Mindestens ein Sonderzeichen erforderlich (!@#$%^&* etc.)'],
  ])('rejects %s', (password, message) => {
    expect(firstError(passwordSchema.safeParse(password))).toBe(message);
  });
});

describe('emailSchema', () => {
  it('accepts a regular address', () => {
    expect(emailSchema.safeParse('info@kuechenstudio-muster.de').success).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(firstError(emailSchema.safeParse('kein-at-zeichen.de'))).toBe('Ungültige E-Mail-Adresse');
  });

  it('rejects addresses longer than 255 characters', () => {
    const result = emailSchema.safeParse(`${'a'.repeat(250)}@test.de`);
    expect(result.success ? [] : result.error.issues.map((i) => i.message)).toContain('E-Mail-Adresse zu lang');
  });
});
