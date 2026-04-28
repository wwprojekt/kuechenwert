import * as React from 'npm:react@18.3.1';
import { Text, Section } from 'npm:@react-email/components@0.0.22';
import { EmailLayout, InfoBox, DetailRow } from '../email-components.tsx';

interface AppointmentPinProps {
  settings: any;
  name: string;
  pin: string;
  appointmentDate: string;
  stationName: string;
  kitchenModel: string;
}

export const AppointmentPin = ({
  settings,
  name,
  pin,
  appointmentDate,
  stationName,
  kitchenModel,
}: AppointmentPinProps) => (
  <EmailLayout 
    preview="Ihre PIN für die Fahrzeugübergabe"
    settings={settings}
  >
    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '16px 0' }}>
      Hallo {name},
    </Text>
    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '16px 0' }}>
      Hier ist Ihre persönliche PIN für die Übergabe Ihres Wohnmobils:
    </Text>

    <InfoBox variant="warning">
      <Section style={{ textAlign: 'center' }}>
        <Text style={{ 
          fontSize: '48px', 
          fontWeight: 'bold', 
          letterSpacing: '8px', 
          color: '#195d3e',
          margin: '20px 0',
        }}>
          {pin}
        </Text>
      </Section>
      <Text style={{ fontSize: '14px', textAlign: 'center', color: '#666', margin: '8px 0' }}>
        Bitte geben Sie diese PIN beim Termin an der Ankaufstation an.
      </Text>
    </InfoBox>

    <InfoBox title="Termindetails">
      <DetailRow label="Fahrzeug" value={kitchenModel} />
      <DetailRow label="Datum & Uhrzeit" value={appointmentDate} />
      <DetailRow label="Ankaufstation" value={stationName} />
    </InfoBox>

    <InfoBox variant="info">
      <Text style={{ fontSize: '14px', margin: '8px 0' }}>
        <strong>Wichtig:</strong> Diese PIN ist nur für diesen einen Termin gültig und bestätigt Ihre Identität bei der Fahrzeugübergabe.
      </Text>
    </InfoBox>

    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '24px 0' }}>
      Wir freuen uns auf Ihren Besuch!
    </Text>
  </EmailLayout>
);

export default AppointmentPin;
