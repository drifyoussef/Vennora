"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormError, TextField } from "@/components/vennora/form";
import { formatDateTime } from "@/lib/format";
import { envoyerDocumentAction } from "./document-actions";

/**
 * Une ligne de document, avec ses deux gestes utiles.
 *
 * Le téléchargement passe par un lien signé qui expire, préparé côté serveur :
 * la clé de stockage ne circule jamais seule. L'envoi ouvre une boîte de
 * dialogue plutôt que de partir au clic — un document part chez un client,
 * ça ne se déclenche pas par mégarde.
 */
export function DocumentRow({
  id,
  nom,
  categorie,
  creeLe,
  url,
  emailClient,
  envoiAutorise,
}: {
  id: string;
  nom: string;
  categorie: string;
  creeLe: string;
  /** Lien signé, valable quelques minutes. */
  url: string;
  emailClient: string | null;
  envoiAutorise: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function envoyer(formData: FormData) {
    setErreur(null);
    demarrer(async () => {
      const r = await envoyerDocumentAction(id, formData);
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      setOuvert(false);
      toast.success(
        r.data.driver === "console"
          ? `Envoi simulé vers ${r.data.sentTo} (pilote console).`
          : `Document envoyé à ${r.data.sentTo}.`,
      );
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm">{nom}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{categorie}</span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {formatDateTime(creeLe)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <Button asChild size="sm" variant="ghost" className="gap-1.5">
          <a href={url} target="_blank" rel="noreferrer noopener">
            <Download className="size-4" />
            <span className="sr-only sm:not-sr-only">Télécharger</span>
          </a>
        </Button>

        {envoiAutorise ? (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => setOuvert(true)}
          >
            <Mail className="size-4" />
            <span className="sr-only sm:not-sr-only">Envoyer</span>
          </Button>
        ) : (
          <span
            className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground"
            title="L'envoi par e-mail est compris à partir de l'offre Pro."
          >
            <Lock className="size-3.5" />
          </span>
        )}
      </div>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent>
          <form action={envoyer}>
            <DialogHeader>
              <DialogTitle>Envoyer « {nom} »</DialogTitle>
              <DialogDescription>
                Le document part en pièce jointe. Une réponse du client
                arrivera sur votre adresse.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <TextField
                label="Destinataire"
                name="to"
                type="email"
                required
                defaultValue={emailClient ?? ""}
                autoComplete="email"
              />
              <div className="space-y-1.5">
                <label htmlFor="message" className="text-sm font-medium">
                  Message <span className="text-muted-foreground">(facultatif)</span>
                </label>
                <Textarea
                  id="message"
                  name="message"
                  rows={3}
                  placeholder="Bonjour, voici le document demandé…"
                />
              </div>
              <FormError message={erreur} />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOuvert(false)}
                disabled={enCours}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={enCours} className="gap-1.5">
                {enCours ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                Envoyer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </li>
  );
}
