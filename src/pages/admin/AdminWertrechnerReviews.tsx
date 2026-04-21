import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Star,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  RefreshCw,
  Loader2,
  Search,
} from "lucide-react";
import { wertrechnerReviewStatsQueryKey } from "@/hooks/useWertrechnerReviewStats";

type ReviewStatus = "pending" | "approved" | "rejected" | "spam";
type StatusFilter = ReviewStatus | "all";

interface AdminReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  reviewer_location: string | null;
  vehicle_type: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  published_at: string | null;
  moderated_at: string | null;
  moderated_by: string | null;
}

const STATUS_LABELS: Record<ReviewStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Ausstehend", color: "bg-amber-100 text-amber-900", icon: Clock },
  approved: { label: "Freigegeben", color: "bg-emerald-100 text-emerald-900", icon: CheckCircle2 },
  rejected: { label: "Abgelehnt", color: "bg-slate-100 text-slate-700", icon: XCircle },
  spam: { label: "Spam", color: "bg-red-100 text-red-900", icon: Ban },
};

function StarRow({ rating }: { rating: number }) {
  const safe = Math.max(0, Math.min(5, rating));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${safe} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((pos) => (
        <Star
          key={pos}
          className={`h-3.5 w-3.5 ${
            safe >= pos ? "fill-amber-400 text-amber-400" : "text-gray-300"
          }`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export default function AdminWertrechnerReviews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<null | {
    id: string;
    action: "approve" | "reject" | "spam";
    rating: number;
    commentPreview: string;
  }>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: reviews = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-wertrechner-reviews", statusFilter],
    queryFn: async (): Promise<AdminReviewRow[]> => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return [];
      let query = supabase
        .from("wertrechner_reviews")
        .select(
          "id, rating, comment, reviewer_name, reviewer_email, reviewer_location, vehicle_type, status, rejection_reason, created_at, published_at, moderated_at, moderated_by",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AdminReviewRow[];
    },
    staleTime: 30_000,
  });

  const filteredReviews = useMemo(() => {
    if (!search.trim()) return reviews;
    const q = search.trim().toLowerCase();
    return reviews.filter((r) =>
      [r.comment, r.reviewer_name, r.reviewer_email, r.reviewer_location]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [reviews, search]);

  const moderateMutation = useMutation({
    mutationFn: async (input: {
      id: string;
      action: "approve" | "reject" | "spam" | "pending";
      reason?: string;
    }) => {
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Sitzung ungültig, bitte neu anmelden");
      const { data, error } = await supabase.rpc("admin_moderate_wertrechner_review", {
        p_review_id: input.id,
        p_action: input.action,
        p_reason: input.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wertrechner-reviews"] });
      queryClient.invalidateQueries({ queryKey: wertrechnerReviewStatsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["wertrechner-reviews-list"] });
      toast({
        title: "Erfolgreich moderiert",
        description: "Die Bewertung wurde aktualisiert.",
      });
      setPendingAction(null);
      setRejectionReason("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Fehler bei der Moderation",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const confirmAction = () => {
    if (!pendingAction) return;
    moderateMutation.mutate({
      id: pendingAction.id,
      action: pendingAction.action,
      reason:
        pendingAction.action === "approve" || rejectionReason.trim() === ""
          ? undefined
          : rejectionReason.trim(),
    });
  };

  const counts = useMemo(() => {
    return reviews.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [reviews]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Wertrechner-Bewertungen
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Bewertungen, die Nutzer nach der Wertrechner-Schätzung abgegeben haben. Alle
            neuen Bewertungen müssen hier freigegeben werden, bevor sie auf{" "}
            <code>/wertrechner#reviews</code> und im WebApplication-Schema erscheinen.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="approved">Freigegeben</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kommentar / Name / Ort / E-Mail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Aktualisieren"
            >
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {(Object.keys(STATUS_LABELS) as ReviewStatus[]).map((status) => {
              const Icon = STATUS_LABELS[status].icon;
              return (
                <div
                  key={status}
                  className="flex items-center gap-2 rounded border bg-muted/30 p-3"
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-muted-foreground">
                    {STATUS_LABELS[status].label}
                  </span>
                  <span className="ml-auto tabular-nums font-semibold">
                    {statusFilter === status || statusFilter === "all"
                      ? counts[status] ?? 0
                      : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Sterne</TableHead>
                  <TableHead>Bewertung</TableHead>
                  <TableHead className="w-[150px]">Reviewer</TableHead>
                  <TableHead className="w-[110px]">Fahrzeugtyp</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[130px]">Eingegangen</TableHead>
                  <TableHead className="w-[180px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin inline-block" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredReviews.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Keine Bewertungen gefunden.
                    </TableCell>
                  </TableRow>
                )}
                {filteredReviews.map((r) => {
                  const statusMeta =
                    STATUS_LABELS[r.status as ReviewStatus] ??
                    { label: r.status, color: "bg-muted", icon: Clock };
                  const created = new Date(r.created_at);
                  const dateStr = Number.isNaN(created.getTime())
                    ? ""
                    : format(created, "dd.MM.yyyy HH:mm", { locale: de });
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <StarRow rating={r.rating} />
                      </TableCell>
                      <TableCell className="max-w-md">
                        {r.comment ? (
                          <p className="whitespace-pre-wrap break-words text-sm">{r.comment}</p>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Ohne Kommentar</span>
                        )}
                        {r.rejection_reason && (
                          <p className="mt-1 text-xs text-red-600">
                            Ablehnungsgrund: {r.rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.reviewer_name || "Anonym"}</div>
                        {r.reviewer_location && (
                          <div className="text-muted-foreground">{r.reviewer_location}</div>
                        )}
                        {r.reviewer_email && (
                          <div className="text-muted-foreground truncate max-w-[130px]" title={r.reviewer_email}>
                            {r.reviewer_email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.vehicle_type ? (
                          <Badge variant="outline" className="text-xs capitalize">
                            {r.vehicle_type}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusMeta.color} text-xs`}>
                          {statusMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {dateStr}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.status !== "approved" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() =>
                                setPendingAction({
                                  id: r.id,
                                  action: "approve",
                                  rating: r.rating,
                                  commentPreview: r.comment?.slice(0, 120) ?? "(kein Kommentar)",
                                })
                              }
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Freigeben
                            </Button>
                          )}
                          {r.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPendingAction({
                                  id: r.id,
                                  action: "reject",
                                  rating: r.rating,
                                  commentPreview: r.comment?.slice(0, 120) ?? "(kein Kommentar)",
                                })
                              }
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Ablehnen
                            </Button>
                          )}
                          {r.status !== "spam" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPendingAction({
                                  id: r.id,
                                  action: "spam",
                                  rating: r.rating,
                                  commentPreview: r.comment?.slice(0, 120) ?? "(kein Kommentar)",
                                })
                              }
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" /> Spam
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "approve" && "Bewertung freigeben?"}
              {pendingAction?.action === "reject" && "Bewertung ablehnen?"}
              {pendingAction?.action === "spam" && "Bewertung als Spam markieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StarRow rating={pendingAction?.rating ?? 0} />
                  <span className="text-sm text-muted-foreground">
                    {pendingAction?.rating} Sterne
                  </span>
                </div>
                <p className="text-sm italic text-muted-foreground">
                  „{pendingAction?.commentPreview}"
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(pendingAction?.action === "reject" || pendingAction?.action === "spam") && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="reject-reason" className="text-xs">
                Grund (optional, nur intern)
              </Label>
              <Textarea
                id="reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="z.B. beleidigend, off-topic, Konkurrenz-Schmähung…"
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionReason("")}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={moderateMutation.isPending}
            >
              {moderateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Bestätigen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
