import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError } from "@/lib/sessionGuard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, Clock, CheckCircle, Eye, Send, Car, Trash2, Loader2, ExternalLink } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface VehicleQuestion {
  id: string;
  motorhome_id: string;
  questioner_name: string | null;
  questioner_email: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  motorhome?: {
    id: string;
    manufacturer: string;
    model: string;
    year: number;
    body_type: string;
    listing_number: string | null;
    motorhome_photos?: Array<{ url: string; card_url: string | null; medium_url: string | null; display_order: number }>;
    auctions?: Array<{ id: string; status: string }>;
  };
}

export default function AdminQuestions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<VehicleQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<VehicleQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "unanswered" | "answered">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from("vehicle_questions")
        .select(`
          *,
          motorhome:motorhomes (
            id,
            manufacturer,
            model,
            year,
            body_type,
            listing_number,
            motorhome_photos(url, card_url, medium_url, display_order),
            auctions(id, status)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuestions((data as VehicleQuestion[]) || []);
    } catch (error) {
      console.error("Error fetching questions:", error);
      toast({
        title: "Fehler",
        description: "Fragen konnten nicht geladen werden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const PAGE_SIZE = 20;

  // Reset Seite bei Filter-Änderung
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const getFirstPhoto = (question: VehicleQuestion): string | null => {
    const photos = question.motorhome?.motorhome_photos;
    if (!photos || !Array.isArray(photos) || photos.length === 0) return null;
    const sorted = [...photos].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const first = sorted[0];
    return first?.card_url || first?.url || null;
  };

  const getAuctionId = (question: VehicleQuestion): string | null => {
    const auctions = question.motorhome?.auctions;
    if (!auctions || !Array.isArray(auctions) || auctions.length === 0) return null;
    return auctions[0]?.id || null;
  };

  const handleAnswerQuestion = async () => {
    if (!selectedQuestion || !answer.trim()) return;

    setIsSubmitting(true);

    try {
      const vehicleTitle = selectedQuestion.motorhome
        ? `${selectedQuestion.motorhome.manufacturer} ${selectedQuestion.motorhome.model}`
        : "Fahrzeug";

      const listingInfo = selectedQuestion.motorhome?.listing_number
        ? ` (Inserat #${selectedQuestion.motorhome.listing_number})`
        : "";

      // Build the email HTML body with the answer and vehicle context
      const bodyHtml = `
        <p>Sie haben eine Frage zu dem Fahrzeug <strong>${vehicleTitle}${listingInfo}</strong> gestellt:</p>
        <blockquote style="border-left: 3px solid #1f8aa2; padding: 12px 16px; margin: 16px 0; background-color: #f8fafc; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; color: #374151; font-style: italic;">${selectedQuestion.question}</p>
        </blockquote>
        <p><strong>Unsere Antwort:</strong></p>
        <p>${answer.trim().replace(/\n/g, '<br>')}</p>
      `;

      // Send email via send-admin-email edge function
      const { data: emailData, error: emailError } = await invokeWithAuth("send-admin-email", {
        body: {
          to: selectedQuestion.questioner_email,
          subject: `Antwort auf Ihre Frage zum ${vehicleTitle}`,
          body_html: bodyHtml,
          recipient_name: selectedQuestion.questioner_name || undefined,
          reply_to_message_id: selectedQuestion.id,
          reply_to_message_type: "vehicle_question",
          plain_answer: answer.trim(),
        },
      });

      if (emailError) throw emailError;
      if (emailData?.error) throw new Error(emailData.error);

      toast({
        title: "Antwort gesendet",
        description: `Die Antwort wurde per E-Mail an ${selectedQuestion.questioner_email} gesendet`,
      });

      setSelectedQuestion(null);
      setAnswer("");
      fetchQuestions();
    } catch (error) {
      console.error("Error answering question:", error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("vehicle_questions")
        .delete()
        .in("id", ids);
      if (error) throw error;
      toast({
        title: `${ids.length} Frage${ids.length > 1 ? "n" : ""} gelöscht`,
        description: "Die ausgewählten Fragen wurden entfernt.",
      });
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (error) {
      toast({ title: "Fehler beim Löschen", description: String(error), variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteIds([]);
    }
  };

  const openDeleteDialog = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteDialogOpen(true);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === "unanswered") return !q.answer;
    if (filter === "answered") return !!q.answer;
    return true;
  });

  const totalItems = filteredQuestions.length;
  const pageQuestions = filteredQuestions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const unansweredCount = questions.filter((q) => !q.answer).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Fahrzeugfragen</h1>
          <p className="text-muted-foreground">
            Beantworten Sie Fragen zu Fahrzeugen
          </p>
        </div>
        <div className="flex items-center gap-4">
          {unansweredCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unansweredCount} unbeantwortete Fragen
            </Badge>
          )}
          <Select
            value={filter}
            onValueChange={(val) => setFilter(val as typeof filter)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Fragen</SelectItem>
              <SelectItem value="unanswered">Unbeantwortet</SelectItem>
              <SelectItem value="answered">Beantwortet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Eingegangene Fragen
          </CardTitle>
          <CardDescription>
            {filteredQuestions.length} Fragen gefunden
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Lädt...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Fragen gefunden</p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredQuestions.length > 0 && selectedIds.size === filteredQuestions.length}
                      onCheckedChange={() => {
                        if (selectedIds.size === filteredQuestions.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
                        }
                      }}
                      aria-label="Alle auswählen"
                    />
                  </TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Fragesteller</TableHead>
                  <TableHead>Frage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageQuestions.map((question) => {
                  const photo = getFirstPhoto(question);
                  const auctionId = getAuctionId(question);

                  return (
                    <TableRow key={question.id} className={selectedIds.has(question.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(question.id)}
                          onCheckedChange={() => toggleSelection(question.id)}
                          aria-label="Frage auswählen"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {photo ? (
                            <img
                              src={photo}
                              alt={`${question.motorhome?.manufacturer} ${question.motorhome?.model}`}
                              className="w-14 h-10 object-cover rounded border"
                            />
                          ) : (
                            <div className="w-14 h-10 bg-muted rounded border flex items-center justify-center">
                              <Car className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {question.motorhome?.manufacturer} {question.motorhome?.model}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {question.motorhome?.year && (
                                <span>{question.motorhome.year}</span>
                              )}
                              {question.motorhome?.listing_number && (
                                <span className="font-mono">#{question.motorhome.listing_number}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {auctionId && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/admin/auctions/${auctionId}`);
                                  }}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Auktion
                                </Button>
                              )}
                              {question.motorhome?.id && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-muted-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/admin/motorhomes/${question.motorhome!.id}`);
                                  }}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  Details
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{question.questioner_name || "Anonym"}</p>
                          <p className="text-xs text-muted-foreground">{question.questioner_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate">{question.question}</p>
                      </TableCell>
                      <TableCell>
                        {question.answer ? (
                          <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Beantwortet
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-orange-600 border-orange-600">
                            <Clock className="w-3 h-3" />
                            Offen
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(question.created_at), "dd.MM.yyyy HH:mm", {
                          locale: de,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedQuestion(question);
                              setAnswer(question.answer || "");
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {question.answer ? "Ansehen" : "Beantworten"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog([question.id])}
                            title="Frage löschen"
                            className="hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {totalItems > PAGE_SIZE && (
              <div className="px-4 pb-4">
                <AdminPagination
                  page={currentPage}
                  pageSize={PAGE_SIZE}
                  totalItems={totalItems}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Delete Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border shadow-lg rounded-lg px-4 py-3">
          <span className="text-sm font-medium">
            {selectedIds.size} ausgewählt
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Aufheben
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => openDeleteDialog(Array.from(selectedIds))}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {selectedIds.size} löschen
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {deleteIds.length === 1 ? "Frage löschen" : `${deleteIds.length} Fragen löschen`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIds.length === 1
                ? "Möchten Sie diese Frage wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
                : `Möchten Sie wirklich ${deleteIds.length} Fragen löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteIds)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Löschen...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" />Endgültig löschen</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Answer Dialog */}
      <Dialog open={!!selectedQuestion} onOpenChange={() => setSelectedQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Frage zum Fahrzeug
            </DialogTitle>
          </DialogHeader>

          {/* Vehicle Info Card in Dialog */}
          {selectedQuestion?.motorhome && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg border">
              {(() => {
                const photo = selectedQuestion ? getFirstPhoto(selectedQuestion) : null;
                return photo ? (
                  <img
                    src={photo}
                    alt={`${selectedQuestion.motorhome?.manufacturer} ${selectedQuestion.motorhome?.model}`}
                    className="w-24 h-16 object-cover rounded border flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-16 bg-muted rounded border flex items-center justify-center flex-shrink-0">
                    <Car className="w-8 h-8 text-muted-foreground" />
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-base">
                  {selectedQuestion.motorhome.manufacturer} {selectedQuestion.motorhome.model}
                </p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                  {selectedQuestion.motorhome.year && (
                    <span>Baujahr {selectedQuestion.motorhome.year}</span>
                  )}
                  {selectedQuestion.motorhome.body_type && (
                    <span>{selectedQuestion.motorhome.body_type}</span>
                  )}
                  {selectedQuestion.motorhome.listing_number && (
                    <span className="font-mono">#{selectedQuestion.motorhome.listing_number}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {(() => {
                    const auctionId = selectedQuestion ? getAuctionId(selectedQuestion) : null;
                    return auctionId ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => navigate(`/admin/auctions/${auctionId}`)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Zur Auktion
                      </Button>
                    ) : null;
                  })()}
                  {selectedQuestion.motorhome.id && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-muted-foreground"
                      onClick={() => navigate(`/admin/motorhomes/${selectedQuestion.motorhome!.id}`)}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Fahrzeugdetails
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">
                  {selectedQuestion?.questioner_name || "Anonym"}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({selectedQuestion?.questioner_email})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedQuestion?.created_at &&
                    format(new Date(selectedQuestion.created_at), "dd.MM.yyyy HH:mm", {
                      locale: de,
                    })}
                </p>
              </div>
              <p className="whitespace-pre-wrap">{selectedQuestion?.question}</p>
            </div>

            {selectedQuestion?.answer && selectedQuestion?.answered_at && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="font-medium text-green-700 dark:text-green-400 text-sm">
                    Beantwortet am {format(new Date(selectedQuestion.answered_at), "dd.MM.yyyy HH:mm", { locale: de })}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-sm">{selectedQuestion.answer}</p>
              </div>
            )}

            {!selectedQuestion?.answer && (
              <div className="space-y-2">
                <Label htmlFor="answer">Ihre Antwort</Label>
                <Textarea
                  id="answer"
                  placeholder="Geben Sie Ihre Antwort ein..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Die Antwort wird per E-Mail an {selectedQuestion?.questioner_email} gesendet.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedQuestion(null)}>
              {selectedQuestion?.answer ? "Schließen" : "Abbrechen"}
            </Button>
            {!selectedQuestion?.answer && (
              <Button onClick={handleAnswerQuestion} disabled={isSubmitting || !answer.trim()}>
                <Send className="w-4 h-4 mr-2" />
                {isSubmitting ? "Wird gesendet..." : "Antwort per E-Mail senden"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
