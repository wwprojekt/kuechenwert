// Email template builder with dynamic settings support

export interface Settings {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
  logo_url?: string;
  primary_color?: string;
}

const getColors = (settings: Settings) => ({
  primary: settings.primary_color || '#195d3e',
  success: '#155724',
  warning: '#856404',
  info: '#0c5460',
  text: '#333333',
  lightBg: '#f5f5f5',
  border: '#e6e6e6',
});

export const buildEmailLayout = (settings: Settings, title: string, content: string) => {
  const colors = getColors(settings);
  
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #ffffff;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 20px; text-align: center; border-bottom: 3px solid ${colors.primary};">
              ${settings.logo_url 
                ? `<img src="${settings.logo_url}" alt="${settings.site_name}" style="max-width: 200px; height: auto;" />`
                : `<h1 style="margin: 0; color: ${colors.primary}; font-size: 32px;">${settings.site_name}</h1>`
              }
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: ${colors.lightBg}; border-top: 1px solid ${colors.border}; text-align: center;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #666;">
                <strong>${settings.site_name}</strong> - ${settings.site_description}
              </p>
              <p style="margin: 10px 0; font-size: 12px; color: #999;">
                <a href="mailto:${settings.contact_email}" style="color: ${colors.primary}; text-decoration: none;">${settings.contact_email}</a>
                &nbsp;|&nbsp;
                <a href="tel:${settings.support_phone}" style="color: ${colors.primary}; text-decoration: none;">${settings.support_phone}</a>
              </p>
              <p style="margin: 10px 0; font-size: 12px; color: #999;">
                <a href="https://caravanwert.de" style="color: ${colors.primary}; text-decoration: none;">Website</a>
                &nbsp;|&nbsp;
                <a href="https://caravanwert.de/datenschutz" style="color: ${colors.primary}; text-decoration: none;">Datenschutz</a>
                &nbsp;|&nbsp;
                <a href="https://caravanwert.de/impressum" style="color: ${colors.primary}; text-decoration: none;">Impressum</a>
              </p>
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

export const infoBox = (title: string, content: string, variant: 'default' | 'success' | 'warning' | 'info' = 'default', settings: Settings) => {
  const colors = getColors(settings);
  const bgColor = variant === 'success' ? '#d4edda' : 
                  variant === 'warning' ? '#fff3cd' : 
                  variant === 'info' ? '#d1ecf1' : colors.lightBg;
  const borderColor = variant === 'success' ? colors.success : 
                      variant === 'warning' ? colors.warning : 
                      variant === 'info' ? colors.info : colors.primary;
  
  return `
    <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 20px; margin: 20px 0;">
      ${title ? `<h2 style="margin: 0 0 15px; color: ${borderColor}; font-size: 20px;">${title}</h2>` : ''}
      ${content}
    </div>
  `;
};

export const detailRow = (label: string, value: string) => {
  return `<p style="margin: 8px 0; font-size: 16px; line-height: 24px;"><strong>${label}:</strong> ${value}</p>`;
};

export const button = (text: string, url: string, settings: Settings) => {
  const colors = getColors(settings);
  return `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${url}" style="display: inline-block; background-color: ${colors.primary}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
        ${text}
      </a>
    </div>
  `;
};

export const paragraph = (text: string) => {
  return `<p style="margin: 16px 0; font-size: 16px; line-height: 26px; color: #333;">${text}</p>`;
};

export const list = (items: string[]) => {
  return `
    <ul style="margin: 16px 0; padding-left: 20px;">
      ${items.map(item => `<li style="margin: 8px 0; font-size: 14px; line-height: 22px;">${item}</li>`).join('')}
    </ul>
  `;
};

export const pinDisplay = (pin: string) => {
  return `
    <div style="text-align: center; margin: 30px 0;">
      <div style="background-color: #fff3cd; border: 2px solid #856404; border-radius: 8px; padding: 30px; display: inline-block;">
        <p style="margin: 0 0 10px; font-size: 14px; color: #856404; font-weight: bold;">IHRE PIN</p>
        <p style="margin: 0; font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #195d3e; font-family: 'Courier New', monospace;">
          ${pin}
        </p>
      </div>
    </div>
  `;
};
