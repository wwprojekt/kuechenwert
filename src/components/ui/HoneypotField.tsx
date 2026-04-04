import { useState } from 'react';

/**
 * Unsichtbares Honeypot-Feld für Bot-Erkennung.
 * 
 * Bots die automatisch alle Felder ausfüllen, befüllen dieses Feld und werden erkannt.
 * Für echte Nutzer ist es komplett unsichtbar (CSS + aria-hidden + tabIndex -1).
 * 
 * Verwendung:
 * ```tsx
 * const [honeypotValue, setHoneypotValue] = useState('');
 * <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
 * // Beim Submit: if (honeypotValue) { return; } // Bot erkannt
 * ```
 */

interface HoneypotFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Optionaler Feldname (Standard: "website") */
  fieldName?: string;
}

export function HoneypotField({ value, onChange, fieldName = 'website' }: HoneypotFieldProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <label htmlFor={`hp_${fieldName}`}>{fieldName}</label>
      <input
        type="text"
        id={`hp_${fieldName}`}
        name={fieldName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * Custom Hook für Honeypot-State.
 * Gibt [value, setValue, isBot] zurück.
 */
export function useHoneypot(): [string, (v: string) => void, boolean] {
  const [value, setValue] = useState('');
  return [value, setValue, value.length > 0];
}
