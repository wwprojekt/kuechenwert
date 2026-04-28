/**
 * Admin "An Händler verkaufen" Dialog
 *
 * Lets an admin manually finalise an auction in ANY non-terminal state
 * (`active`, `kaufchance`, `draft`, `ended`, `cancelled`) as a sale to a
 * chosen dealer at a freely chosen price.
 *
 * Server side runs `admin-sell-to-dealer` which mirrors the full
 * `instant-buy` chain (kitchen.status='sold' → invoice → contract →
 * notifications → Google Ads conversion) so the resulting state is
 * indistinguishable from a normal Sofortkauf for every downstream system.
 *
 * The dialog warns (but does not block) if:
 *   - The selected dealer's account is restricted (admin override)
 *   - The chosen sale price is below the current highest bid
 *   - The auction is in an unusual state for a sale (draft / ended / cancelled)
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { adminSellToDealer } from "@/lib/adminManualSale";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AdminManualSellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auctionId: string;
  kitchenName: string;
  currentBid: number | null;
  sellerId: string | null;
  /**
   * Current auction status. Used to show a context-specific warning when
   * the status is unusual for a sale (`draft`, `ended`, `cancelled`).
   * Optional for backwards compatibility — when omitted, no warning shown.
   */
  auctionStatus?: string | null;
  onSuccess?: () => void;
}

const UNUSUAL_SELL_STATUSES = new Set(["draft", "ended", "cancelled"]);

const STATUS_HINTS: Record<string, { title: string; body: string }> = {
  draft: {
    title: "Auktion ist noch im Entwurf",
    body:
      "Das Inserat wurde nie veröffentlicht. Der Verkauf wird trotzdem durchgeführt — bitte sicherstellen, dass die Fahrzeugdaten korrekt sind, bevor Rechnung und Kaufvertrag erzeugt werden.",
  },
  ended: {
    title: "Auktion ist bereits beendet",
    body:
      "Die Auktionsfrist ist abgelaufen, das Fahrzeug wurde aber noch nicht final verkauft. Manueller Verkauf nachträglich möglich (z. B. nach Verhandlung mit Bietern außerhalb der Plattform).",
  },
  cancelled: {
    title: "Auktion wurde abgebrochen",
    body:
      "Die Auktion wurde zwischenzeitlich storniert. Mit diesem Verkauf wird der Status auf 'verkauft' gesetzt — der ursprüngliche Abbruch bleibt im Audit-Log erhalten.",
  },
};

interface DealerOption {
  userId: string;
  companyName: string;
  contactName: string;
  email: string;
  accountRestricted: boolean;
  restrictionReason: string | null;
  /**
   * Other dealer accounts that share the same normalized company name.
   * Indicates a likely duplicate registration (same dealer registered
   * twice with different emails). Production bug 22.04.2026:
   * KV-2026-00016 (Hymer B-Klasse MasterLine) was sold to the wrong
   * sibling profile and disappeared from the dealer's dashboard.
   */
  duplicateSiblings: Array<{ userId: string; email: string }>;
}

interface DealerApplicationRow {
  user_id: string;
  company_name: string | null;
  contact_person_name: string | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  account_restricted: boolean | null;
  restriction_reason: string | null;
}

async function loadApprovedDealers(): Promise<DealerOption[]> {
  const ok = await ensureValidRLSSession();
  if (!ok) throw new Error("Session abgelaufen");

  // 1. Approved dealer applications (admin-only RLS — caller must be admin)
  const { data: appsRaw, error: appsError } = await supabase
    .from("dealer_applications")
    .select("user_id, company_name, contact_person_name")
    .eq("status", "approved");
  if (appsError) throw appsError;

  const apps = (appsRaw ?? []) as unknown as DealerApplicationRow[];
  if (apps.length === 0) return [];

  // 2. Their profile fields (email + restriction status)
  const userIds = apps.map((a) => a.user_id);
  const { data: profilesRaw, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, account_restricted, restriction_reason")
    .in("id", userIds);
  if (profilesError) throw profilesError;

  const profiles = (profilesRaw ?? []) as unknown as ProfileRow[];

  const baseList = apps.map((app) => {
    const profile = profiles.find((p) => p.id === app.user_id);
    return {
      userId: app.user_id,
      companyName: app.company_name || "(Kein Firmenname)",
      contactName: app.contact_person_name || "",
      email: profile?.email || "",
      accountRestricted: Boolean(profile?.account_restricted),
      restrictionReason: profile?.restriction_reason ?? null,
    };
  });

  // Group by normalized company name so we can flag dealers who registered
  // twice with different emails (e.g. info@ vs ankauf@). Without this hint
  // the dropdown shows two visually identical rows and the admin picks the
  // "wrong" one — the contract then disappears from the dealer's dashboard
  // because /dashboard/contracts filters on `buyer_id = auth.uid()`.
  const normalizeCompany = (name: string): string =>
    name
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/\b(gmbh|kg|ohg|ag|e\.k\.|ug|ltd|inc|co\.?|& co\.?\s*kg|gbr)\b/g, "")
      .replace(/[^a-z0-9 ]+/g, "")
      .trim();

  const byCompany = new Map<string, Array<{ userId: string; email: string }>>();
  for (const d of baseList) {
    const key = normalizeCompany(d.companyName);
    if (!key) continue;
    const list = byCompany.get(key) ?? [];
    list.push({ userId: d.userId, email: d.email });
    byCompany.set(key, list);
  }

  return baseList
    .map<DealerOption>((d) => {
      const key = normalizeCompany(d.companyName);
      const siblings = (byCompany.get(key) ?? []).filter(
        (s) => s.userId !== d.userId,
      );
      return { ...d, duplicateSiblings: siblings };
    })
    .sort((a, b) => a.companyName.localeCompare(b.companyName, "de"));
}

function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminManualSellDialog({
  open,
  onOpenChange,
  auctionId,
  kitchenName,
  currentBid,
  sellerId,
  auctionStatus,
  onSuccess,
}: AdminManualSellDialogProps) {
  const statusHint =
    auctionStatus && UNUSUAL_SELL_STATUSES.has(auctionStatus)
      ? STATUS_HINTS[auctionStatus] ?? null
      : null;
  const [dealerPickerOpen, setDealerPickerOpen] = useState(false);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);
  const [salePriceInput, setSalePriceInput] = useState<string>(
    currentBid ? String(currentBid) : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const dealersQuery = useQuery({
    queryKey: ["adminManualSell.dealers"],
    queryFn: loadApprovedDealers,
    enabled: open,
    staleTime: 60_000,
  });

  const selectedDealer = useMemo(
    () =>
      dealersQuery.data?.find((d) => d.userId === selectedDealerId) ?? null,
    [dealersQuery.data, selectedDealerId],
  );

  // Filter: dealer cannot be the seller
  const dealersFiltered = useMemo(
    () =>
      (dealersQuery.data ?? []).filter((d) =>
        sellerId ? d.userId !== sellerId : true,
      ),
    [dealersQuery.data, sellerId],
  );

  const salePriceNumber = useMemo(() => {
    const cleaned = salePriceInput.replace(/[^0-9]/g, "");
    if (!cleaned) return NaN;
    return Number(cleaned);
  }, [salePriceInput]);

  const priceBelowCurrentBid =
    Number.isFinite(salePriceNumber) &&
    currentBid !== null &&
    currentBid > 0 &&
    salePriceNumber < currentBid;

  const canSubmit =
    !submitting &&
    !!selectedDealerId &&
    Number.isFinite(salePriceNumber) &&
    salePriceNumber > 0 &&
    salePriceNumber <= 9_999_999;

  function reset() {
    setSelectedDealerId(null);
    setSalePriceInput(currentBid ? String(currentBid) : "");
    setDealerPickerOpen(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!canSubmit || !selectedDealerId) return;
    setSubmitting(true);
    try {
      const result = await adminSellToDealer({
        auctionId,
        buyerId: selectedDealerId,
        salePrice: salePriceNumber,
      });

      const errorParts: string[] = [];
      if (result.errors && result.errors.length > 0) {
        errorParts.push(`${result.errors.length} Folge-Schritt(e) fehlgeschlagen`);
      }
      const docParts: string[] = [];
      if (result.invoiceNumber) docParts.push(`Rechnung ${result.invoiceNumber}`);
      if (result.contractNumber) docParts.push(`Vertrag ${result.contractNumber}`);

      const docSuffix = docParts.length ? ` · ${docParts.join(" · ")}` : "";
      const errSuffix = errorParts.length ? ` · ${errorParts.join(", ")}` : "";

      toast.success(
        `Verkauft an ${selectedDealer?.companyName ?? "Händler"} für ${formatEur(salePriceNumber)}${docSuffix}${errSuffix}`,
      );
      if (errorParts.length) {
        toast.warning(
          "Einige Folge-Aktionen sind fehlgeschlagen – bitte Admin-Summary-Mail prüfen.",
        );
      }
      onSuccess?.();
      handleOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Manueller Verkauf fehlgeschlagen";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>An Händler verkaufen (Admin-Verkauf)</DialogTitle>
          <DialogDescription>
            Schließt die Auktion <strong>{kitchenName || "Inserat"}</strong>{" "}
            sofort als Verkauf ab. Käufer + Preis frei wählbar. Es werden
            automatisch Rechnung, Kaufvertrag, Bieter-Mails und die
            Admin-Summary erzeugt – wie bei einem normalen Sofortkauf.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Context hint for unusual auction states (draft / ended / cancelled) */}
          {statusHint && (
            <div className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {statusHint.title}
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  {statusHint.body}
                </p>
              </div>
            </div>
          )}

          {/* Dealer selection */}
          <div className="space-y-2">
            <Label htmlFor="dealer-picker">Käufer (Händler)</Label>
            <Popover
              open={dealerPickerOpen}
              onOpenChange={setDealerPickerOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  id="dealer-picker"
                  variant="outline"
                  role="combobox"
                  aria-expanded={dealerPickerOpen}
                  className="w-full justify-between font-normal"
                  disabled={dealersQuery.isLoading || dealersQuery.isError}
                >
                  {selectedDealer ? (
                    <span className="truncate text-left">
                      {selectedDealer.companyName}
                      {selectedDealer.email ? (
                        <span className="text-muted-foreground">
                          {" · "}
                          {selectedDealer.email}
                        </span>
                      ) : null}
                    </span>
                  ) : dealersQuery.isLoading ? (
                    <span className="text-muted-foreground">
                      Händler werden geladen…
                    </span>
                  ) : dealersQuery.isError ? (
                    <span className="text-destructive">
                      Fehler beim Laden der Händler
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Händler auswählen…
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Suche nach Firma, E-Mail, Name…" />
                  <CommandList>
                    <CommandEmpty>Kein Händler gefunden.</CommandEmpty>
                    <CommandGroup>
                      {dealersFiltered.map((d) => (
                        <CommandItem
                          key={d.userId}
                          value={`${d.companyName} ${d.contactName} ${d.email}`}
                          onSelect={() => {
                            setSelectedDealerId(d.userId);
                            setDealerPickerOpen(false);
                          }}
                          className="flex flex-col items-start gap-0.5"
                        >
                          <div className="flex w-full items-center gap-2">
                            <Check
                              className={cn(
                                "h-4 w-4 shrink-0",
                                selectedDealerId === d.userId
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            <span className="truncate font-medium">
                              {d.companyName}
                            </span>
                            {d.duplicateSiblings.length > 0 && (
                              <Badge
                                variant="outline"
                                className="ml-auto shrink-0 border-amber-500 text-amber-700 dark:text-amber-300"
                                title="Dieser Händler hat mehrere Konten mit gleichem Firmennamen"
                              >
                                Mehrfach registriert
                              </Badge>
                            )}
                            {d.accountRestricted && (
                              <Badge
                                variant="destructive"
                                className={cn(
                                  "shrink-0",
                                  d.duplicateSiblings.length > 0 ? "" : "ml-auto",
                                )}
                              >
                                gesperrt
                              </Badge>
                            )}
                          </div>
                          {(d.contactName || d.email) && (
                            <div className="ml-6 truncate text-xs text-muted-foreground">
                              {[d.contactName, d.email]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {dealersQuery.isError && (
              <p className="text-xs text-destructive">
                {(dealersQuery.error as Error)?.message ||
                  "Händlerliste konnte nicht geladen werden."}
              </p>
            )}
          </div>

          {/* Sale price */}
          <div className="space-y-2">
            <Label htmlFor="sale-price">Verkaufspreis (€)</Label>
            <Input
              id="sale-price"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={salePriceInput}
              onChange={(e) => setSalePriceInput(e.target.value)}
              placeholder="z. B. 45000"
            />
            {currentBid !== null && currentBid > 0 ? (
              <p className="text-xs text-muted-foreground">
                Aktuelles Höchstgebot:{" "}
                <span className="font-medium">{formatEur(currentBid)}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Es wurden bisher keine Gebote abgegeben.
              </p>
            )}
          </div>

          {/* Warnings (do not block) */}
          {selectedDealer && selectedDealer.duplicateSiblings.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Doppel-Registrierung erkannt – bitte richtiges Konto
                  bestätigen
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  „{selectedDealer.companyName}" existiert mit mehreren
                  Händler-Accounts. Du verkaufst gerade an{" "}
                  <strong>{selectedDealer.email || "(keine E-Mail)"}</strong>.
                  Andere Konten desselben Händlers:
                </p>
                <ul className="ml-5 list-disc text-amber-700 dark:text-amber-300">
                  {selectedDealer.duplicateSiblings.map((s) => (
                    <li key={s.userId}>
                      <span className="font-mono">{s.email}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Wähle das Konto, mit dem der Händler tatsächlich auf
                  CaravanWert arbeitet (Bid-Historie / Login). Sonst
                  erscheint der Kaufvertrag nicht in seinem Dashboard.
                </p>
              </div>
            </div>
          )}

          {selectedDealer?.accountRestricted && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  Händler-Konto ist gesperrt – Admin-Override
                </p>
                {selectedDealer.restrictionReason && (
                  <p className="text-muted-foreground">
                    Grund: {selectedDealer.restrictionReason}
                  </p>
                )}
                <p className="text-muted-foreground">
                  Der Verkauf wird trotzdem durchgeführt. Bitte vorher prüfen,
                  ob der Händler die Sperre kennt.
                </p>
              </div>
            </div>
          )}

          {priceBelowCurrentBid && (
            <div className="flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Verkaufspreis liegt unter dem aktuellen Höchstgebot
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  Höchstgebot war {formatEur(currentBid)}. Bitte sicherstellen,
                  dass diese Differenz beabsichtigt ist.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verkauf abschließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
