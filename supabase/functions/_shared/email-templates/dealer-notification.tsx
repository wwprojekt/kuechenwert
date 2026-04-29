import * as React from 'npm:react@18.3.1';
import { Text } from 'npm:@react-email/components@0.0.22';
import { EmailLayout, InfoBox, DetailRow, CTAButton } from '../email-components.tsx';

type DealerNotificationType = 'application_received' | 'approved' | 'rejected';

interface DealerNotificationProps {
  settings: any;
  name: string;
  type: DealerNotificationType;
  companyName: string;
  rejectionReason?: string;
}

export const DealerNotification = ({
  settings,
  name,
  type,
  companyName,
  rejectionReason,
}: DealerNotificationProps) => {
  const getContent = () => {
    switch (type) {
      case 'application_received':
        return {
          preview: 'Händler-Bewerbung erhalten',
          title: 'Bewerbung erhalten',
          message: (
            <>
              <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
                Hallo {name},
              </Text>
              <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
                Vielen Dank für Ihre Bewerbung als Händler bei {settings.site_name}!
              </Text>
              <InfoBox title="Ihre Bewerbung" variant="info">
                <DetailRow label="Unternehmen" value={companyName} />
                <Text style={{ fontSize: '14px', margin: '12px 0 0' }}>
                  Ihre Bewerbung wird derzeit von unserem Team geprüft. Sie erhalten in Kürze eine Rückmeldung per E-Mail.
                </Text>
              </InfoBox>
              <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
                Die Prüfung dauert in der Regel 1-2 Werktage.
              </Text>
            </>
          ),
        };

      case 'approved':
        return {
          preview: 'Händler-Bewerbung genehmigt',
          title: 'Willkommen bei ' + settings.site_name + '!',
          message: (
            <>
              <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
                Hallo {name},
              </Text>
              <Text style={{ fontSize: '16px', lineHeight: '26px', fontWeight: 'bold' }}>
                Herzlichen Glückwunsch! Ihre Bewerbung als Händler wurde genehmigt.
              </Text>
              <InfoBox title="Ihr Händler-Zugang" variant="success">
                <DetailRow label="Unternehmen" value={companyName} />
                <Text style={{ fontSize: '14px', margin: '12px 0 0' }}>
                  Sie haben jetzt Zugriff auf unser Händler-Portal und können auf Wohnmobile bieten.
                </Text>
              </InfoBox>
              <InfoBox title="Nächste Schritte">
                <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Loggen Sie sich in Ihr Händler-Portal ein</Text>
                <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Vervollständigen Sie Ihr Unternehmensprofil</Text>
                <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Entdecken Sie aktuelle Auktionen</Text>
                <Text style={{ fontSize: '14px', margin: '4px 0' }}>✓ Geben Sie Ihr erstes Gebot ab</Text>
              </InfoBox>
              <CTAButton href="https://kuechenwert24.de/dashboard" text="Zum Händler-Portal" />
            </>
          ),
        };

      case 'rejected':
        return {
          preview: 'Händler-Bewerbung - Rückmeldung',
          title: 'Rückmeldung zu Ihrer Bewerbung',
          message: (
            <>
              <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
                Hallo {name},
              </Text>
              <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
                Vielen Dank für Ihr Interesse an einer Partnerschaft mit {settings.site_name}.
              </Text>
              <InfoBox variant="warning">
                <DetailRow label="Unternehmen" value={companyName} />
                <Text style={{ fontSize: '14px', margin: '12px 0 0' }}>
                  Nach sorgfältiger Prüfung können wir Ihre Bewerbung derzeit leider nicht genehmigen.
                </Text>
                {rejectionReason && (
                  <Text style={{ fontSize: '14px', margin: '12px 0 0' }}>
                    <strong>Grund:</strong> {rejectionReason}
                  </Text>
                )}
              </InfoBox>
              <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
                Sie können sich jederzeit erneut bewerben. Bei Fragen stehen wir Ihnen gerne zur Verfügung.
              </Text>
            </>
          ),
        };
    }
  };

  const content = getContent();

  return (
    <EmailLayout preview={content.preview} settings={settings}>
      {content.message}
    </EmailLayout>
  );
};

export default DealerNotification;
