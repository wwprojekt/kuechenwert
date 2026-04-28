import * as React from 'npm:react@18.3.1';
import { Text } from 'npm:@react-email/components@0.0.22';
import { EmailLayout, InfoBox, DetailRow } from '../email-components.tsx';

interface AppointmentConfirmationProps {
  settings: any;
  name: string;
  appointmentDate: string;
  stationName: string;
  stationAddress: string;
  kitchenModel: string;
  appointmentId: string;
}

export const AppointmentConfirmation = ({
  settings,
  name,
  appointmentDate,
  stationName,
  stationAddress,
  kitchenModel,
  appointmentId,
}: AppointmentConfirmationProps) => (
  <EmailLayout 
    preview="Terminbestätigung für Ihre Wohnmobil-Übergabe"
    settings={settings}
  >
    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '16px 0' }}>
      Hallo {name},
    </Text>
    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '16px 0' }}>
      Ihr Termin für die Wohnmobil-Übergabe wurde erfolgreich gebucht. Wir freuen uns auf Ihren Besuch!
    </Text>

    <InfoBox title="Termindetails">
      <DetailRow label="Fahrzeug" value={kitchenModel} />
      <DetailRow label="Datum & Uhrzeit" value={appointmentDate} />
      <DetailRow label="Ankaufstation" value={stationName} />
      <DetailRow label="Adresse" value={stationAddress} />
      <DetailRow label="Termin-ID" value={appointmentId} />
    </InfoBox>

    <InfoBox title="Bitte mitbringen" variant="info">
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Fahrzeugschein (Zulassungsbescheinigung Teil I)</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Fahrzeugbrief (Zulassungsbescheinigung Teil II)</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Personalausweis oder Reisepass</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Alle Fahrzeugschlüssel</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Serviceheft (falls vorhanden)</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ HU/AU-Nachweise</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Rechnungen für Umbauten/Zubehör (falls vorhanden)</Text>
    </InfoBox>

    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '24px 0' }}>
      Bei Fragen oder falls Sie den Termin verschieben müssen, kontaktieren Sie uns bitte rechtzeitig.
    </Text>
  </EmailLayout>
);

export default AppointmentConfirmation;
