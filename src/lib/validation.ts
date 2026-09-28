import { z } from "zod";

/**
 * Strong password validation schema
 * Requires: 8+ characters, uppercase, lowercase, number, special character
 */
export const passwordSchema = z
  .string()
  .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
  .regex(/[A-Z]/, "Mindestens ein Großbuchstabe erforderlich")
  .regex(/[a-z]/, "Mindestens ein Kleinbuchstabe erforderlich")
  .regex(/[0-9]/, "Mindestens eine Zahl erforderlich")
  .regex(/[^A-Za-z0-9]/, "Mindestens ein Sonderzeichen erforderlich (!@#$%^&* etc.)");

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email("Ungültige E-Mail-Adresse")
  .max(255, "E-Mail-Adresse zu lang");
