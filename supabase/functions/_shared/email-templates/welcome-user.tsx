import * as React from 'npm:react@18.3.1';
import { Text } from 'npm:@react-email/components@0.0.22';
import { EmailLayout, InfoBox, CTAButton } from '../email-components.tsx';

interface WelcomeUserProps {
  settings: any;
  name: string;
  email: string;
}

export const WelcomeUser = ({
  settings,
  name,
  email: _email,
}: WelcomeUserProps) => (
  <EmailLayout 
    preview={`Willkommen bei ${settings.site_name}!`}
    settings={settings}
  >
    <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
      Hallo {name},
    </Text>
    <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
      Herzlich willkommen bei {settings.site_name}! Wir freuen uns, dass Sie sich registriert haben.
    </Text>

    <InfoBox title="Was Sie jetzt tun können" variant="success">
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Wohnmobil zum Verkauf anbieten</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Sofortankauf oder Auktion wählen</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Termin an einer Ankaufstation buchen</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Aktuelle Auktionen durchstöbern</Text>
    </InfoBox>

    <InfoBox title="Ihre Vorteile">
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>• Schneller und unkomplizierter Verkauf</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>• Faire Preise durch Händler-Auktionen</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>• Sichere Abwicklung an bundesweiten Stationen</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>• Keine versteckten Kosten</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>• Professionelle Beratung und Support</Text>
    </InfoBox>

    <CTAButton href="https://kuechenwert24.de/verkaufen" text="Jetzt Wohnmobil verkaufen" />

    <Text style={{ fontSize: '14px', lineHeight: '22px', color: '#666', margin: '24px 0' }}>
      Bei Fragen stehen wir Ihnen jederzeit gerne zur Verfügung. Unser Support-Team erreichen Sie unter {settings.contact_email} oder telefonisch unter {settings.support_phone}.
    </Text>
  </EmailLayout>
);

export default WelcomeUser;
