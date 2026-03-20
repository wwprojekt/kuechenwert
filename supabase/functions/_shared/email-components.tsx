import * as React from 'npm:react@18.3.1';
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Button,
} from 'npm:@react-email/components@0.0.22';

interface Settings {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
  logo_url?: string;
  primary_color?: string;
}

// Base Layout Component
export const EmailLayout = ({ 
  children, 
  preview, 
  settings 
}: { 
  children: React.ReactNode; 
  preview: string;
  settings: Settings;
}) => {
  const _primaryColor = settings.primary_color || '#195d3e';
  
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={header}>
            {settings.logo_url ? (
              <Img
                src={settings.logo_url}
                alt={settings.site_name}
                style={logo}
              />
            ) : (
              <Heading style={{ ...h1, margin: '0' }}>{settings.site_name}</Heading>
            )}
          </Section>

          {/* Main Content */}
          {children}

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              {settings.site_name} - {settings.site_description}
            </Text>
            <Text style={footerText}>
              <Link href={`mailto:${settings.contact_email}`} style={footerLink}>
                {settings.contact_email}
              </Link>
              {' | '}
              <Link href={`tel:${settings.support_phone}`} style={footerLink}>
                {settings.support_phone}
              </Link>
            </Text>
            <Text style={footerText}>
              <Link href="https://caravanwert.de" style={footerLink}>
                Website besuchen
              </Link>
              {' | '}
              <Link href="https://caravanwert.de/datenschutz" style={footerLink}>
                Datenschutz
              </Link>
              {' | '}
              <Link href="https://caravanwert.de/impressum" style={footerLink}>
                Impressum
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Info Box Component
export const InfoBox = ({ 
  title, 
  children, 
  variant = 'default' 
}: { 
  title?: string; 
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info';
}) => {
  const boxStyle = {
    ...infoBox,
    backgroundColor: variant === 'success' ? '#d4edda' : 
                     variant === 'warning' ? '#fff3cd' : 
                     variant === 'info' ? '#d1ecf1' : '#f5f5f5',
    borderLeft: `4px solid ${
      variant === 'success' ? '#155724' : 
      variant === 'warning' ? '#856404' : 
      variant === 'info' ? '#0c5460' : '#195d3e'
    }`,
  };

  return (
    <Section style={boxStyle}>
      {title && <Heading style={h2}>{title}</Heading>}
      {children}
    </Section>
  );
};

// Call to Action Button
export const CTAButton = ({ 
  href, 
  text 
}: { 
  href: string; 
  text: string;
}) => (
  <Section style={buttonContainer}>
    <Button href={href} style={button}>
      {text}
    </Button>
  </Section>
);

// Detail Row Component
export const DetailRow = ({ 
  label, 
  value 
}: { 
  label: string; 
  value: string;
}) => (
  <Text style={detailRow}>
    <strong>{label}:</strong> {value}
  </Text>
);

// Styles
const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px',
};

const header = {
  padding: '20px 0',
  textAlign: 'center' as const,
};

const logo = {
  maxWidth: '200px',
  height: 'auto',
  margin: '0 auto',
};

const h1 = {
  color: '#195d3e',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '30px 0 20px',
  padding: '0',
};

const h2 = {
  color: '#195d3e',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 15px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const infoBox = {
  backgroundColor: '#f5f5f5',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const detailRow = {
  ...text,
  margin: '8px 0',
};

const buttonContainer = {
  margin: '32px 0',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#195d3e',
  borderRadius: '6px',
  color: '#fff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 'bold',
  lineHeight: '50px',
  textAlign: 'center' as const,
  textDecoration: 'none',
  padding: '0 32px',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '40px 0',
};

const footer = {
  margin: '20px 0',
};

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '20px',
  textAlign: 'center' as const,
  margin: '8px 0',
};

const footerLink = {
  color: '#195d3e',
  textDecoration: 'underline',
};
