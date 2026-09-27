import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/features/marketplace/api-client";
import { EMAIL_PREFERENCE_OPTIONS, type EmailAudience, type EmailPreferences } from "./email-preferences";
import { fetchEmailPreferences, saveEmailPreferences } from "./email-preferences-api";

export function EmailPreferencesCard({ audience }: { audience: EmailAudience }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["email-preferences", user?.id] as const;
  const query = useQuery({ queryKey, queryFn: () => fetchEmailPreferences(user!.id), enabled: !!user?.id });

  const save = useMutation({
    mutationFn: (next: EmailPreferences) => saveEmailPreferences(user!.id, next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<EmailPreferences>(queryKey);
      qc.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKey, ctx.previous);
      toast.error(errorMessage(err));
    },
    onSuccess: () => toast.success("E-Mail-Einstellungen gespeichert."),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Freiwillige E-Mails
        </CardTitle>
        <CardDescription>
          Jederzeit änderbar. E-Mails zu Ihren Projekten, Aufträgen und Rechnungen erhalten Sie unabhängig davon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : query.isError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-destructive/10 p-4 text-sm">
            <span>{errorMessage(query.error)}</span>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Erneut laden
            </Button>
          </div>
        ) : (
          EMAIL_PREFERENCE_OPTIONS[audience].map((option) => (
            <label key={option.key} className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
              <span>
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
              <Switch
                checked={query.data[option.key]}
                disabled={save.isPending}
                onCheckedChange={(checked) => save.mutate({ ...query.data, [option.key]: checked })}
              />
            </label>
          ))
        )}
      </CardContent>
    </Card>
  );
}
