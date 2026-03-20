import * as React from 'npm:react@18.3.1';
import { Text } from 'npm:@react-email/components@0.0.22';
import { EmailLayout, InfoBox, DetailRow } from '../email-components.tsx';

interface PaymentConfirmationProps {
  settings: any;
  name: string;
  motorhomeModel: string;
  amount: string;
  paymentMethod: string;
  appointmentId: string;
  handoverProtocolUrl?: string;
}

export const PaymentConfirmation = ({
  settings,
  name,
  motorhomeModel,
  amount,
  paymentMethod,
  appointmentId,
  handoverProtocolUrl,
}: PaymentConfirmationProps) => (
  <EmailLayout 
    preview="Zahlungsbestätigung für Ihren Wohnmobilverkauf"
    settings={settings}
  >
    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '16px 0' }}>
      Hallo {name},
    </Text>
    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '16px 0' }}>
      Vielen Dank für Ihr Vertrauen! Die Übergabe Ihres Wohnmobils wurde erfolgreich abgeschlossen.
    </Text>

    <InfoBox title="Zahlungsdetails" variant="success">
      <DetailRow label="Fahrzeug" value={motorhomeModel} />
      <DetailRow label="Betrag" value={amount} />
      <DetailRow label="Zahlungsmethode" value={paymentMethod} />
      <DetailRow label="Termin-ID" value={appointmentId} />
    </InfoBox>

    {handoverProtocolUrl && (
      <InfoBox title="Übergabeprotokoll" variant="info">
        <Text style={{ fontSize: '14px', margin: '8px 0' }}>
          Ihr Übergabeprotokoll wurde erstellt und ist als PDF verfügbar:
        </Text>
        <Text style={{ fontSize: '14px', margin: '12px 0' }}>
          <a 
            href={handoverProtocolUrl} 
            style={{ 
              color: '#195d3e', 
              textDecoration: 'underline',
              fontWeight: 'bold',
            }}
          >
            Übergabeprotokoll herunterladen (PDF)
          </a>
        </Text>
      </InfoBox>
    )}

    <InfoBox title="Was passiert jetzt?">
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Ihre Zahlung wurde verarbeitet</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Das Übergabeprotokoll wurde dokumentiert</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Sie erhalten eine Kopie aller Dokumente</Text>
      <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Die Eigentumsübertragung wird eingeleitet</Text>
    </InfoBox>

    <Text style={{ fontSize: '16px', lineHeight: '26px', margin: '24px 0' }}>
      Wir bedanken uns für die angenehme Zusammenarbeit und wünschen Ihnen alles Gute!
    </Text>

    <Text style={{ fontSize: '14px', lineHeight: '22px', color: '#666', margin: '24px 0' }}>
      Bei Fragen zu Ihrer Transaktion stehen wir Ihnen jederzeit gerne zur Verfügung.
    </Text>
  </EmailLayout>
);

export default PaymentConfirmation;
