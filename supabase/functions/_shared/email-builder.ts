// Email template builder – CaravanWert Branding
// Professionelles Design mit Logo, Website-Farben (Teal/Cyan #1f8aa2)
// Konsistent mit caravanwert.de

export interface Settings {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
  logo_url?: string;
  primary_color?: string;
}

const BRAND = {
  // Primärfarben – identisch mit der Website (HSL 191, 68%, 38%)
  primary: '#1f8aa2',
  primaryLight: '#239cb8',
  primaryDark: '#1a7489',
  primaryDarker: '#0f4f5c',

  // Text
  heading: '#111827',
  text: '#374151',
  textLight: '#6b7280',
  textMuted: '#9ca3af',

  // Hintergründe
  white: '#ffffff',
  bgLight: '#f8fafc',
  bgGray: '#f1f5f9',
  footerBg: '#0f4f5c',
  footerText: '#94a3b8',
  footerLink: '#67e8f9',

  // Rahmen
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Varianten
  successBg: '#ecfdf5',
  successBorder: '#10b981',
  successText: '#065f46',
  warningBg: '#fffbeb',
  warningBorder: '#f59e0b',
  warningText: '#92400e',
  infoBg: '#ecfeff',
  infoBorder: '#06b6d4',
  infoText: '#155e75',
  dangerBg: '#fef2f2',
  dangerBorder: '#ef4444',
  dangerText: '#991b1b',

  // Sonstiges
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  logoUrl: 'https://zcrwqxsyptjwkuxfacvq.supabase.co/storage/v1/object/public/branding/logo-email.png',
};

export const buildEmailLayout = (settings: Settings, title: string, content: string) => {
  const siteName = settings.site_name || 'CaravanWert';
  const siteDesc = settings.site_description || 'Deutschlands führende Wohnmobil-Handelsplattform';
  const contactEmail = settings.contact_email || 'kontakt@caravanwert.de';
  const supportPhone = settings.support_phone || '+49 511 51532476';
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: ${BRAND.font}; background-color: #eef2f7; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Outer wrapper for background -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #eef2f7;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <!-- Main container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: ${BRAND.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">

          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND.primaryDarker} 0%, ${BRAND.primary} 50%, ${BRAND.primaryLight} 100%); padding: 32px 40px; text-align: center;">
              <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background-color: ${BRAND.primary}; padding: 32px 40px; text-align: center;"><![endif]-->
              <a href="https://caravanwert.de" style="text-decoration: none; display: inline-block;">
                <img src="${BRAND.logoUrl}" alt="${siteName}" width="220" style="display: block; margin: 0 auto; max-width: 220px; height: auto;" />
              </a>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>

          <!-- Accent line -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, ${BRAND.primaryLight} 0%, ${BRAND.primary} 50%, ${BRAND.primaryDark} 100%); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Content area -->
          <tr>
            <td style="padding: 40px 40px 10px;">
              <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: ${BRAND.heading}; line-height: 1.3;">${title}</h1>
              ${content}
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding: 10px 40px 35px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid ${BRAND.border}; padding-top: 25px;">
                    <p style="margin: 0 0 4px; font-size: 15px; color: ${BRAND.text}; font-weight: 600;">Mit freundlichen Gr&uuml;&szlig;en</p>
                    <p style="margin: 0 0 4px; font-size: 15px; color: ${BRAND.primary}; font-weight: 700;">Ihr ${siteName} Team</p>
                    <p style="margin: 0; font-size: 13px; color: ${BRAND.textLight};">${siteDesc}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND.footerBg}; padding: 30px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <!-- Contact info -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0 0 6px; font-size: 13px; color: ${BRAND.footerLink}; font-weight: 600;">${siteName}</p>
                    <p style="margin: 0; font-size: 12px; color: ${BRAND.footerText};">
                      <a href="mailto:${contactEmail}" style="color: ${BRAND.footerText}; text-decoration: none;">${contactEmail}</a>
                      &nbsp;&bull;&nbsp;
                      <a href="tel:${supportPhone.replace(/\s/g, '')}" style="color: ${BRAND.footerText}; text-decoration: none;">${supportPhone}</a>
                    </p>
                  </td>
                </tr>
                <!-- Divider -->
                <tr>
                  <td style="padding-bottom: 16px;">
                    <div style="height: 1px; background-color: rgba(255,255,255,0.15);"></div>
                  </td>
                </tr>
                <!-- Links -->
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0; font-size: 12px;">
                      <a href="https://caravanwert.de" style="color: ${BRAND.footerLink}; text-decoration: none; font-weight: 500;">Website</a>
                      &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                      <a href="https://caravanwert.de/datenschutz" style="color: ${BRAND.footerLink}; text-decoration: none; font-weight: 500;">Datenschutz</a>
                      &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                      <a href="https://caravanwert.de/impressum" style="color: ${BRAND.footerLink}; text-decoration: none; font-weight: 500;">Impressum</a>
                      &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                      <a href="https://caravanwert.de/faq" style="color: ${BRAND.footerLink}; text-decoration: none; font-weight: 500;">FAQ</a>
                    </p>
                  </td>
                </tr>
                <!-- Copyright -->
                <tr>
                  <td align="center">
                    <p style="margin: 0; font-size: 11px; color: rgba(148,163,184,0.7);">
                      &copy; ${year} ${siteName}. Alle Rechte vorbehalten.
                    </p>
                    <p style="margin: 6px 0 0; font-size: 11px; color: rgba(148,163,184,0.5);">
                      Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht direkt auf diese Nachricht.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

export const infoBox = (title: string, content: string, variant: 'default' | 'success' | 'warning' | 'info' = 'default', _settings?: Settings) => {
  const styles = {
    default: { bg: BRAND.bgGray, border: BRAND.primary, title: BRAND.primaryDark, iconBg: '#e0f2fe' },
    success: { bg: BRAND.successBg, border: BRAND.successBorder, title: BRAND.successText, iconBg: '#d1fae5' },
    warning: { bg: BRAND.warningBg, border: BRAND.warningBorder, title: BRAND.warningText, iconBg: '#fef3c7' },
    info:    { bg: BRAND.infoBg, border: BRAND.infoBorder, title: BRAND.infoText, iconBg: '#cffafe' },
  };
  const s = styles[variant] || styles.default;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background-color: ${s.bg}; border-left: 4px solid ${s.border}; border-radius: 0 8px 8px 0; padding: 20px 24px;">
          ${title ? `<h3 style="margin: 0 0 14px; color: ${s.title}; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${title}</h3>` : ''}
          ${content}
        </td>
      </tr>
    </table>
  `;
};

export const detailRow = (label: string, value: string) => {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0;">
      <tr>
        <td style="padding: 8px 0; font-size: 14px; line-height: 20px; color: ${BRAND.textLight}; width: 140px; vertical-align: top; font-weight: 500;">${label}</td>
        <td style="padding: 8px 0; font-size: 14px; line-height: 20px; color: ${BRAND.heading}; font-weight: 600;">${value}</td>
      </tr>
    </table>
  `;
};

export const button = (text: string, url: string, _settings?: Settings) => {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="16%" fillcolor="${BRAND.primary}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">${text}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${url}" style="background-color: ${BRAND.primary}; color: ${BRAND.white}; padding: 15px 36px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 700; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 2px 4px rgba(31,138,162,0.3); transition: background-color 0.2s;">
            ${text}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `;
};

export const paragraph = (text: string) => {
  return `<p style="color: ${BRAND.text}; font-size: 15px; line-height: 1.7; margin: 16px 0;">${text}</p>`;
};

export const list = (items: string[]) => {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 16px 0;">
      ${items.map(item => `
        <tr>
          <td style="width: 24px; vertical-align: top; padding: 6px 0; font-size: 14px; color: ${BRAND.primary};">&#10003;</td>
          <td style="padding: 6px 0; font-size: 14px; line-height: 1.6; color: ${BRAND.text};">${item}</td>
        </tr>
      `).join('')}
    </table>
  `;
};

export const pinDisplay = (pin: string) => {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: ${BRAND.bgGray}; border: 2px dashed ${BRAND.border}; border-radius: 12px; padding: 24px 40px;">
            <tr>
              <td align="center">
                <p style="margin: 0 0 8px; font-size: 12px; color: ${BRAND.textLight}; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">Ihr Freigabe-PIN</p>
                <p style="margin: 0; font-size: 40px; font-weight: 800; color: ${BRAND.primary}; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                  ${pin}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
};

export const amountDisplay = (label: string, amount: string) => {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td align="center" style="background-color: ${BRAND.bgGray}; border-radius: 12px; padding: 24px;">
          <p style="margin: 0 0 6px; font-size: 13px; color: ${BRAND.textLight}; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${label}</p>
          <p style="margin: 0; font-size: 32px; font-weight: 800; color: ${BRAND.primary};">${amount}</p>
        </td>
      </tr>
    </table>
  `;
};

export const warningBox = (text: string) => {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background-color: ${BRAND.dangerBg}; border: 1px solid #fecaca; border-left: 4px solid ${BRAND.dangerBorder}; border-radius: 0 8px 8px 0; padding: 16px 20px;">
          <p style="margin: 0; font-size: 14px; color: ${BRAND.dangerText}; font-weight: 600; line-height: 1.5;">${text}</p>
        </td>
      </tr>
    </table>
  `;
};

export const divider = () => {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="height: 1px; background-color: ${BRAND.border}; font-size: 0; line-height: 0;">&nbsp;</td>
      </tr>
    </table>
  `;
};

export const customerBadge = (customerNumber?: string | null) => {
  if (!customerNumber) return '';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 16px;">
      <tr>
        <td>
          <span style="display: inline-block; background-color: ${BRAND.bgGray}; border: 1px solid ${BRAND.border}; border-radius: 6px; padding: 4px 12px; font-size: 12px; color: ${BRAND.textLight}; font-weight: 600; letter-spacing: 0.3px;">
            Kundennr.: <span style="color: ${BRAND.primary}; font-weight: 700;">${customerNumber}</span>
          </span>
        </td>
      </tr>
    </table>
  `;
};

export const greeting = (name?: string) => {
  if (name) {
    return `<p style="color: ${BRAND.text}; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Guten Tag ${name},</p>`;
  }
  return `<p style="color: ${BRAND.text}; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">Guten Tag,</p>`;
};
