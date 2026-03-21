// Email template builder – CaravanWert Branding
// Einheitliches Design: Dunkelblau (#1a365d) Header, Blau (#2563eb) Buttons
// Identisch mit den Supabase Auth E-Mail-Templates

export interface Settings {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
  logo_url?: string;
  primary_color?: string;
}

const BRAND = {
  headerBg: '#1a365d',
  headerSubtitle: '#93c5fd',
  buttonBg: '#2563eb',
  text: '#374151',
  textLight: '#6b7280',
  textMuted: '#9ca3af',
  footerBg: '#f3f4f6',
  footerBorder: '#e5e7eb',
  white: '#ffffff',
  font: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

export const buildEmailLayout = (settings: Settings, title: string, content: string) => {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${BRAND.font}; background-color: ${BRAND.white};">
  <div style="max-width: 600px; margin: 0 auto; background-color: ${BRAND.white};">
    <!-- Header -->
    <div style="background-color: ${BRAND.headerBg}; padding: 30px; text-align: center;">
      <h1 style="color: ${BRAND.white}; margin: 0; font-size: 28px; font-weight: 700;">${settings.site_name || 'CaravanWert'}</h1>
      <p style="color: ${BRAND.headerSubtitle}; margin: 5px 0 0; font-size: 14px;">${settings.site_description || 'Ihr Wohnmobil-Marktplatz'}</p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="color: ${BRAND.headerBg}; font-size: 22px; margin-top: 0;">${title}</h2>
      ${content}
    </div>

    <!-- Footer -->
    <div style="background-color: ${BRAND.footerBg}; padding: 20px 30px; text-align: center; border-top: 1px solid ${BRAND.footerBorder};">
      <p style="color: ${BRAND.textMuted}; font-size: 12px; margin: 0 0 8px;">
        &copy; ${new Date().getFullYear()} ${settings.site_name || 'CaravanWert'} &ndash; ${settings.site_description || 'Ihr Wohnmobil-Marktplatz'}
      </p>
      <p style="color: ${BRAND.textMuted}; font-size: 12px; margin: 0 0 8px;">
        <a href="mailto:${settings.contact_email || 'kontakt@caravanwert.de'}" style="color: ${BRAND.buttonBg}; text-decoration: none;">${settings.contact_email || 'kontakt@caravanwert.de'}</a>
        &nbsp;|&nbsp;
        <a href="tel:${settings.support_phone || ''}" style="color: ${BRAND.buttonBg}; text-decoration: none;">${settings.support_phone || ''}</a>
      </p>
      <p style="color: ${BRAND.textMuted}; font-size: 12px; margin: 0;">
        <a href="https://caravanwert.de" style="color: ${BRAND.buttonBg}; text-decoration: none;">Website</a>
        &nbsp;|&nbsp;
        <a href="https://caravanwert.de/datenschutz" style="color: ${BRAND.buttonBg}; text-decoration: none;">Datenschutz</a>
        &nbsp;|&nbsp;
        <a href="https://caravanwert.de/impressum" style="color: ${BRAND.buttonBg}; text-decoration: none;">Impressum</a>
      </p>
      <p style="color: ${BRAND.textMuted}; font-size: 11px; margin: 8px 0 0;">
        Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht darauf.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const infoBox = (title: string, content: string, variant: 'default' | 'success' | 'warning' | 'info' = 'default', _settings?: Settings) => {
  const bgColor = variant === 'success' ? '#dcfce7' :
                  variant === 'warning' ? '#fef3c7' :
                  variant === 'info' ? '#dbeafe' : '#f1f5f9';
  const borderColor = variant === 'success' ? '#16a34a' :
                      variant === 'warning' ? '#d97706' :
                      variant === 'info' ? '#2563eb' : BRAND.headerBg;
  const titleColor = variant === 'success' ? '#15803d' :
                     variant === 'warning' ? '#92400e' :
                     variant === 'info' ? '#1e40af' : BRAND.headerBg;

  return `
    <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${title ? `<h3 style="margin: 0 0 12px; color: ${titleColor}; font-size: 18px;">${title}</h3>` : ''}
      ${content}
    </div>
  `;
};

export const detailRow = (label: string, value: string) => {
  return `<p style="margin: 8px 0; font-size: 16px; line-height: 24px; color: ${BRAND.text};"><strong>${label}:</strong> ${value}</p>`;
};

export const button = (text: string, url: string, _settings?: Settings) => {
  return `
    <div style="text-align: center; margin: 35px 0;">
      <a href="${url}" style="background-color: ${BRAND.buttonBg}; color: ${BRAND.white}; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
        ${text}
      </a>
    </div>
  `;
};

export const paragraph = (text: string) => {
  return `<p style="color: ${BRAND.text}; font-size: 16px; line-height: 1.6; margin: 16px 0;">${text}</p>`;
};

export const list = (items: string[]) => {
  return `
    <ul style="margin: 16px 0; padding-left: 20px;">
      ${items.map(item => `<li style="margin: 8px 0; font-size: 15px; line-height: 1.5; color: ${BRAND.text};">${item}</li>`).join('')}
    </ul>
  `;
};

export const pinDisplay = (pin: string) => {
  return `
    <div style="text-align: center; margin: 35px 0;">
      <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; display: inline-block;">
        <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND.textLight}; font-weight: 600;">IHR FREIGABE-PIN</p>
        <span style="font-size: 36px; font-weight: 700; color: ${BRAND.headerBg}; letter-spacing: 6px; font-family: 'Courier New', monospace;">
          ${pin}
        </span>
      </div>
    </div>
  `;
};

export const amountDisplay = (label: string, amount: string) => {
  return `
    <div style="text-align: center; margin: 25px 0; padding: 20px; background-color: #f1f5f9; border-radius: 8px;">
      <p style="margin: 0 0 5px; font-size: 14px; color: ${BRAND.textLight};">${label}</p>
      <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND.headerBg};">${amount}</p>
    </div>
  `;
};

export const warningBox = (text: string) => {
  return `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #991b1b; font-weight: 600;">${text}</p>
    </div>
  `;
};
