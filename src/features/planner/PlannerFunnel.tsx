import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { FunnelFrame, type FunnelNav } from "@/components/funnel/funnel-frame";
import { PlzStep } from "@/components/funnel/plz-step";
import { RequestOffersDialog } from "./components/RequestOffersDialog";
import { RenderStatusChip, useRenderPercent } from "./components/RenderProgress";
import { stepDef, type PlannerStep } from "./flow";
import { ApplianceLevelStep, CookingStep, ExtrasStep, MoreAppliancesStep, ServicesStep } from "./steps/ApplianceSteps";
import { FrontColorStep, FrontStep, HandleStep, QualityStep, StyleStep } from "./steps/DesignSteps";
import { CabinetStep, SinkStep, WorktopColorStep, WorktopStep } from "./steps/EquipmentSteps";
import { LeadContactStep, LeadNameStep, OffersStep, PLANNER_CONTACT_FORM, PLANNER_NAME_FORM, TimeframeStep } from "./steps/LeadSteps";
import { ResultStep } from "./steps/ResultStep";
import { FormStep, MeasureStep, PhotoStep } from "./steps/RoomSteps";
import { VisualizingStep } from "./steps/VisualizingStep";
import { WishesStep } from "./steps/WishesStep";
import type { PlannerFunnel as Controller } from "./usePlannerFunnel";

const SAVED_IN_BROWSER = "Ihre Planung bleibt in diesem Browser gespeichert. Sie können später genau hier weitermachen.";

const HEADINGS: Record<PlannerStep, { heading: string; hint?: string }> = {
  form: { heading: "Welche Form soll Ihre Küche haben?", hint: "Wählen Sie die Form, die Ihrem Raum am nächsten kommt." },
  masse: { heading: "Wie lang sind die Wände ungefähr?", hint: "Grobe Werte genügen – das Küchenstudio misst vor Ort nach." },
  foto: { heading: "Haben Sie ein Foto Ihres Raums?", hint: "Dann zeigt Ihnen die KI die neue Küche genau in Ihrem Raum." },
  stil: { heading: "Welcher Stil gefällt Ihnen?" },
  qualitaet: { heading: "Welche Qualität darf es sein?", hint: "Der größte Preisfaktor – Sie können sie jederzeit ändern." },
  fronten: { heading: "Welches Material sollen die Fronten haben?" },
  farbe: { heading: "Welche Farbe sollen die Fronten haben?" },
  griffe: { heading: "Welche Griffe wünschen Sie sich?" },
  arbeitsplatte: { heading: "Welche Arbeitsplatte soll es sein?", hint: "Täglich im Einsatz – das Material entscheidet über Pflege und Preis." },
  plattenfarbe: { heading: "Welche Farbe soll die Arbeitsplatte haben?" },
  schraenke: { heading: "Wie viel Stauraum brauchen Sie?" },
  spuele: { heading: "Welche Spüle und Armatur?" },
  geraeteklasse: { heading: "Welche Geräte-Klasse?", hint: "Bestimmt Ausstattung, Design und Preis aller Elektrogeräte." },
  kochen: { heading: "Wie möchten Sie kochen und kühlen?" },
  geraete: { heading: "Welche Geräte sollen noch hinein?", hint: "Mehrfachauswahl möglich." },
  extras: { heading: "Welche Extras wünschen Sie sich?", hint: "Mehrfachauswahl möglich." },
  leistungen: { heading: "Was soll das Küchenstudio übernehmen?", hint: "Mehrfachauswahl möglich." },
  wuensche: { heading: "Haben Sie besondere Wünsche?", hint: "Optional – die KI berücksichtigt sie in Ihrer Visualisierung." },
  plz: { heading: "Wo soll Ihre neue Küche hin?", hint: "Für regionale Preise und Küchenstudios in Ihrer Nähe." },
  visualisierung: { heading: "Ihre Küche wird visualisiert …" },
  angebote: { heading: "Möchten Sie auch kostenlose Angebote von Küchenstudios?" },
  zeitrahmen: { heading: "Wann soll Ihre neue Küche kommen?", hint: "So können die Studios Lieferzeit und Montage einplanen." },
  name: { heading: "Fast geschafft! Wie dürfen wir Sie ansprechen?" },
  kontakt: { heading: "Wohin dürfen wir Ihre Küche schicken?", hint: "Danach sehen Sie Küche und Preis sofort – und erhalten beides per E-Mail." },
  ergebnis: { heading: "Hier ist Ihre neue Küche" },
};

function SkipDetails({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      title="Mit beliebten Standardwerten direkt zum Einbauort"
      className="mt-3 inline-flex min-h-9 items-center text-sm font-medium text-primary underline-offset-4 hover:underline short:mt-2"
    >
      Details überspringen
    </button>
  );
}

/** Funnel C im gemeinsamen Funnel-Rahmen: eine Frage pro Bildschirm. */
export function PlannerFunnel({ c }: { c: Controller }) {
  const { state, step, actions, planner } = c;
  const routerNavigate = useNavigate();
  const def = stepDef(step);
  const renderPercent = useRenderPercent(c.renderPhase, c.renderStarted);
  const selectedPhoto = state.photos.find((p) => p.path === state.selectedPhotoPath) ?? null;
  const configProps = { config: state.config, onChange: planner.patchConfig, onAdvance: actions.goNext };
  const firstName = c.contact.first_name.trim();

  let content: ReactNode = null;
  let nav: FunnelNav | null = { onBack: actions.goBack, onNext: actions.goNext, blockedHint: c.blocked };
  let heading = HEADINGS[step].heading;
  let hint = HEADINGS[step].hint;
  let above: ReactNode = null;

  switch (step) {
    case "form":
      nav = { ...nav, onBack: undefined };
      content = <FormStep form={state.room.form} onForm={planner.setForm} onAdvance={actions.goNext} />;
      break;
    case "masse":
      content = <MeasureStep room={state.room} wallIssues={c.wallIssues} showAllWallErrors={c.showWallErrors} onWall={planner.setWall} />;
      break;
    case "foto":
      nav = { ...nav, nextLabel: state.photos.length ? "Weiter" : "Ohne Foto weiter" };
      content = (
        <PhotoStep
          photos={state.photos}
          selectedPhotoPath={state.selectedPhotoPath}
          onUpload={actions.handleUpload}
          onRemovePhoto={actions.handleRemovePhoto}
          onSelectPhoto={planner.selectPhoto}
        />
      );
      break;
    case "stil":
      content = <StyleStep {...configProps} />;
      break;
    case "qualitaet":
      content = <QualityStep {...configProps} />;
      break;
    case "fronten":
      content = <FrontStep {...configProps} />;
      break;
    case "farbe":
      content = <FrontColorStep {...configProps} />;
      break;
    case "griffe":
      content = <HandleStep {...configProps} />;
      break;
    case "arbeitsplatte":
      content = <WorktopStep {...configProps} />;
      break;
    case "plattenfarbe":
      content = <WorktopColorStep {...configProps} />;
      break;
    case "schraenke":
      content = <CabinetStep {...configProps} />;
      break;
    case "spuele":
      content = <SinkStep {...configProps} />;
      break;
    case "geraeteklasse":
      content = <ApplianceLevelStep {...configProps} />;
      break;
    case "kochen":
      content = <CookingStep {...configProps} />;
      break;
    case "geraete":
      content = <MoreAppliancesStep {...configProps} />;
      break;
    case "extras":
      content = <ExtrasStep {...configProps} />;
      break;
    case "leistungen":
      content = <ServicesStep {...configProps} />;
      break;
    case "wuensche":
      nav = { ...nav, nextLabel: state.config.wishes?.trim() ? "Weiter" : "Überspringen" };
      content = <WishesStep wishes={state.config.wishes ?? ""} onWishes={(wishes) => planner.patchConfig({ wishes })} />;
      break;
    case "plz":
      nav = { ...nav, nextLabel: state.submitted ? "Neu visualisieren" : "Küche visualisieren" };
      content = <PlzStep value={state.postalCode} onChange={planner.setPostalCode} onSubmit={actions.goNext} />;
      break;
    case "visualisierung":
      nav = null;
      content = <VisualizingStep percent={renderPercent} photoUrl={selectedPhoto?.url ?? null} error={c.genError} />;
      break;
    case "angebote":
      above = <RenderStatusChip phase={c.renderPhase} percent={renderPercent} />;
      content = <OffersStep value={state.offersChoice} onChange={planner.setOffersChoice} onAdvance={actions.goNext} />;
      break;
    case "zeitrahmen":
      above = <RenderStatusChip phase={c.renderPhase} percent={renderPercent} />;
      nav = { ...nav, nextLabel: state.timeframe ? "Weiter" : "Überspringen" };
      content = <TimeframeStep value={state.timeframe} onChange={planner.setTimeframe} onAdvance={actions.goNext} />;
      break;
    case "name":
      above = <RenderStatusChip phase={c.renderPhase} percent={renderPercent} />;
      nav = { ...nav, onNext: undefined, nextForm: PLANNER_NAME_FORM };
      content = <LeadNameStep contact={c.contact} errors={c.leadErrors} onChange={c.setContact} onSubmit={actions.submitName} />;
      break;
    case "kontakt":
      above = <RenderStatusChip phase={c.renderPhase} percent={renderPercent} />;
      nav = { ...nav, onNext: undefined, nextForm: PLANNER_CONTACT_FORM, nextLabel: "Meine Küche ansehen", busy: c.submitting, busyLabel: "Wird freigeschaltet …" };
      content = (
        <LeadContactStep
          contact={c.contact}
          errors={c.leadErrors}
          wantsOffers={state.offersChoice === "ja"}
          onChange={c.setContact}
          onSubmit={actions.submitLead}
          onChangeChoice={() => actions.navigate("angebote")}
          honeypot={c.honeypot}
          onHoneypot={c.setHoneypot}
          turnstileRef={c.turnstileCallbackRef}
        />
      );
      break;
    case "ergebnis":
      heading = firstName ? `${firstName}, hier ist Ihre neue Küche` : HEADINGS.ergebnis.heading;
      hint = "Visualisierung und Preisschätzung haben wir Ihnen auch per E-Mail geschickt.";
      nav = state.offersRequested
        ? { onNext: () => routerNavigate("/projekt"), nextLabel: "Zu meiner Projektseite", mobileOnly: true }
        : { onNext: () => c.setOffersDialog(true), nextLabel: "Kostenlose Angebote anfordern", mobileOnly: true };
      content = (
        <ResultStep
          renders={state.renders}
          active={c.activeRender}
          beforePhotoUrl={selectedPhoto?.url ?? null}
          estimate={c.estimate}
          generating={c.generating}
          error={c.genError}
          outdated={c.activeOutdated}
          startedAt={c.renderStarted}
          offersRequested={state.offersRequested}
          onGenerate={actions.handleGenerate}
          onSelectRender={planner.setActiveRender}
          onFeedback={actions.handleFeedback}
          onRequestOffers={() => c.setOffersDialog(true)}
          onAdjust={() => actions.navigate("stil")}
          onNewPlanning={actions.startOver}
          aiTraining={c.aiTraining}
        />
      );
      break;
  }

  if (def.detail && !state.submitted) {
    content = (
      <>
        {content}
        <SkipDetails onSkip={actions.skipDetails} />
      </>
    );
  }

  return (
    <>
      <FunnelFrame
        stepKey={step}
        current={c.progress.current}
        total={c.progress.total}
        percent={c.progress.percent}
        heading={heading}
        hint={hint}
        hintAlways={step === "plz"}
        above={above}
        nav={nav}
        width={step === "ergebnis" ? "xl" : step === "stil" || step === "form" ? "lg" : "md"}
        guardExit={!state.submitted && (step !== "form" || state.photos.length > 0)}
        savedHint={SAVED_IN_BROWSER}
        headerAside={
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:inline-flex">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" /> Kostenlos · automatisch gespeichert
          </span>
        }
      >
        {content}
      </FunnelFrame>
      <RequestOffersDialog open={c.offersDialog} onOpenChange={c.setOffersDialog} busy={c.offersBusy} error={c.offersError} onConfirm={actions.confirmOffers} />
    </>
  );
}
