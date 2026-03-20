import * as React from 'npm:react@18.3.1';
import { Text } from 'npm:@react-email/components@0.0.22';
import { EmailLayout, InfoBox, DetailRow, CTAButton } from '../email-components.tsx';

type NotificationType = 'new_auction' | 'new_bid' | 'outbid' | 'won' | 'lost' | 'ending_soon' | 'auction_started';

interface AuctionNotificationProps {
  settings: any;
  name: string;
  type: NotificationType;
  motorhomeModel: string;
  auctionUrl: string;
  currentBid?: string;
  yourBid?: string;
  endTime?: string;
}

const getContent = (type: NotificationType, props: AuctionNotificationProps) => {
  const { name, motorhomeModel, currentBid, yourBid, endTime, auctionUrl } = props;

  switch (type) {
    case 'auction_started':
      return {
        preview: 'Ihre Auktion wurde gestartet',
        title: 'Ihre Auktion ist jetzt live!',
        variant: 'success' as const,
        message: (
          <>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hallo {name},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Ihr Wohnmobil wurde erfolgreich in die Auktion aufgenommen und ist jetzt für Händler sichtbar.
            </Text>
            <InfoBox title="Fahrzeugdetails" variant="success">
              <DetailRow label="Fahrzeug" value={motorhomeModel} />
              {currentBid && <DetailRow label="Startgebot" value={currentBid} />}
              {endTime && <DetailRow label="Auktionsende" value={endTime} />}
            </InfoBox>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Sie werden per E-Mail benachrichtigt, wenn neue Gebote eingehen.
            </Text>
            <CTAButton href={auctionUrl} text="Auktion ansehen" />
          </>
        ),
      };

    case 'new_auction':
      return {
        preview: 'Neue Auktion verfügbar',
        title: 'Neue Auktion verfügbar',
        variant: 'info' as const,
        message: (
          <>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hallo {name},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Eine neue Auktion, die Ihren Kriterien entspricht, ist jetzt verfügbar:
            </Text>
            <InfoBox title="Fahrzeugdetails" variant="info">
              <DetailRow label="Fahrzeug" value={motorhomeModel} />
              {currentBid && <DetailRow label="Startgebot" value={currentBid} />}
              {endTime && <DetailRow label="Endet am" value={endTime} />}
            </InfoBox>
            <CTAButton href={auctionUrl} text="Jetzt bieten" />
          </>
        ),
      };

    case 'new_bid':
      return {
        preview: 'Neues Gebot auf Ihr Wohnmobil',
        title: 'Neues Gebot eingegangen',
        variant: 'success' as const,
        message: (
          <>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hallo {name},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Auf Ihr Wohnmobil wurde ein neues Gebot abgegeben:
            </Text>
            <InfoBox title="Gebotsdetails" variant="success">
              <DetailRow label="Fahrzeug" value={motorhomeModel} />
              {currentBid && <DetailRow label="Aktuelles Höchstgebot" value={currentBid} />}
            </InfoBox>
            <CTAButton href={auctionUrl} text="Auktion ansehen" />
          </>
        ),
      };

    case 'outbid':
      return {
        preview: 'Sie wurden überboten',
        title: 'Sie wurden überboten',
        variant: 'warning' as const,
        message: (
          <>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hallo {name},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Ein anderer Händler hat ein höheres Gebot abgegeben:
            </Text>
            <InfoBox title="Gebotsdetails" variant="warning">
              <DetailRow label="Fahrzeug" value={motorhomeModel} />
              {yourBid && <DetailRow label="Ihr Gebot" value={yourBid} />}
              {currentBid && <DetailRow label="Aktuelles Höchstgebot" value={currentBid} />}
            </InfoBox>
            <CTAButton href={auctionUrl} text="Höher bieten" />
          </>
        ),
      };

    case 'won':
      return {
        preview: 'Glückwunsch! Auktion gewonnen',
        title: 'Herzlichen Glückwunsch!',
        variant: 'success' as const,
        message: (
          <>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hallo {name},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px', fontWeight: 'bold' }}>
              Sie haben die Auktion gewonnen!
            </Text>
            <InfoBox title="Auktionsdetails" variant="success">
              <DetailRow label="Fahrzeug" value={motorhomeModel} />
              {currentBid && <DetailRow label="Ihr Gebot" value={currentBid} />}
            </InfoBox>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Wir werden uns in Kürze mit den nächsten Schritten zur Abwicklung bei Ihnen melden.
            </Text>
            <CTAButton href={auctionUrl} text="Details ansehen" />
          </>
        ),
      };

    case 'lost':
      return {
        preview: 'Auktion beendet',
        title: 'Auktion beendet',
        variant: 'default' as const,
        message: (
          <>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hallo {name},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Die Auktion für folgendes Fahrzeug wurde beendet:
            </Text>
            <InfoBox title="Auktionsdetails">
              <DetailRow label="Fahrzeug" value={motorhomeModel} />
              {yourBid && <DetailRow label="Ihr Gebot" value={yourBid} />}
              {currentBid && <DetailRow label="Höchstgebot" value={currentBid} />}
            </InfoBox>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Entdecken Sie weitere verfügbare Wohnmobile in unserer Plattform.
            </Text>
            <CTAButton href="https://caravanwert.de/kaufen" text="Weitere Auktionen" />
          </>
        ),
      };

    case 'ending_soon':
      return {
        preview: 'Auktion endet bald!',
        title: 'Auktion endet bald!',
        variant: 'warning' as const,
        message: (
          <>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Hallo {name},
            </Text>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Eine Auktion, für die Sie geboten haben, endet in Kürze:
            </Text>
            <InfoBox title="Auktionsdetails" variant="warning">
              <DetailRow label="Fahrzeug" value={motorhomeModel} />
              {yourBid && <DetailRow label="Ihr Gebot" value={yourBid} />}
              {currentBid && <DetailRow label="Aktuelles Höchstgebot" value={currentBid} />}
              {endTime && <DetailRow label="Endet am" value={endTime} />}
            </InfoBox>
            <Text style={{ fontSize: '16px', lineHeight: '26px' }}>
              Letzte Chance zum Bieten!
            </Text>
            <CTAButton href={auctionUrl} text="Jetzt bieten" />
          </>
        ),
      };

    default:
      return {
        preview: 'Auktionsaktualisierung',
        title: 'Auktionsaktualisierung',
        variant: 'default' as const,
        message: <Text>Ihre Auktion wurde aktualisiert.</Text>,
      };
  }
};

export const AuctionNotification = (props: AuctionNotificationProps) => {
  const content = getContent(props.type, props);

  return (
    <EmailLayout preview={content.preview} settings={props.settings}>
      {content.message}
    </EmailLayout>
  );
};

export default AuctionNotification;
