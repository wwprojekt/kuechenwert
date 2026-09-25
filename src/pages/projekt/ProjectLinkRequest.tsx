import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/features/marketplace/api-client";
import { requestProjectLink } from "@/features/marketplace/project-api";

export function ProjectLinkRequest() {
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: () => requestProjectLink(email.trim()) });

  if (mutation.isSuccess) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-primary" />
        <p className="mt-3 font-semibold">Prüfen Sie Ihr Postfach</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Wenn zu {email} ein Küchenprojekt existiert, erhalten Sie in wenigen Minuten eine E-Mail mit Ihrem persönlichen Projektlink.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Mail className="h-5 w-5 text-primary" /> Projektlink per E-Mail anfordern
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Geben Sie die E-Mail-Adresse an, mit der Sie Ihr Küchenprojekt angelegt haben.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="project-email" className="sr-only">
            E-Mail-Adresse
          </Label>
          <Input id="project-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ihre@email.de" className="h-11" />
        </div>
        <Button type="submit" className="h-11" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Link senden
        </Button>
      </div>
      {mutation.isError && <p className="mt-2 text-sm text-destructive">{errorMessage(mutation.error)}</p>}
    </form>
  );
}
