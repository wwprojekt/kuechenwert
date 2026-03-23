import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { MessageCircle, Clock, CheckCircle, Eye, Send, Car, Trash2, Loader2 } from "lucide-react";
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
    manufacturer: string;
    model: string;
    listing_number: string | null;
  };
}

export default function AdminQuestions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questions, setQuestions] = useState<VehicleQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState<VehicleQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "unanswered" | "answered">("all");
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
            manufacturer,
            model,
            listing_number
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

  const handleAnswerQuestion = async () => {
    if (!selectedQuestion || !answer.trim()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("vehicle_questions")
        .update({
          answer: answer.trim(),
          answered_by: user?.id,
          answered_at: new Date().toISOString(),
        })
        .eq("id", selectedQuestion.id);

      if (error) throw error;

      toast({
        title: "Antwort gesendet",
        description: "Die Frage wurde erfolgreich beantwortet",
      });

      setSelectedQuestion(null);
      setAnswer("");
      fetchQuestions();
    } catch (error) {
      console.error("Error answering question:", error);
      toast({
        title: "Fehler",
        description: "Antwort konnte nicht gesendet werden",
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

  const unansweredCount = questions.filter((q) => !q.answer).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fahrzeugfragen</h1>
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
                {filteredQuestions.map((question) => (
                  <TableRow key={question.id} className={selectedIds.has(question.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(question.id)}
                        onCheckedChange={() => toggleSelection(question.id)}
                        aria-label="Frage auswählen"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-primary" />
                        <div>
                          <p className="font-medium">
                            {question.motorhome?.manufacturer} {question.motorhome?.model}
                          </p>
                          {question.motorhome?.listing_number && (
                            <p className="text-xs text-muted-foreground font-mono">
                              #{question.motorhome.listing_number}
                            </p>
                          )}
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
                ))}
              </TableBody>
            </Table>
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
            <DialogDescription>
              {selectedQuestion?.motorhome?.manufacturer} {selectedQuestion?.motorhome?.model}
              {selectedQuestion?.motorhome?.listing_number && (
                <span className="ml-2 font-mono">#{selectedQuestion.motorhome.listing_number}</span>
              )}
            </DialogDescription>
          </DialogHeader>

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

            <div className="space-y-2">
              <Label htmlFor="answer">Ihre Antwort</Label>
              <Textarea
                id="answer"
                placeholder="Geben Sie Ihre Antwort ein..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="min-h-[150px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedQuestion(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleAnswerQuestion} disabled={isSubmitting || !answer.trim()}>
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? "Wird gesendet..." : "Antwort senden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
