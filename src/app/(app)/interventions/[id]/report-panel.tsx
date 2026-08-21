"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  FileText,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
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
import { FormError, TextAreaField, TextField } from "@/components/vennora/form";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  generateReportAction,
  saveReportAction,
  sendReportAction,
  regenerateReportPdfAction,
  validateReportAction,
  type ReportSectionValues,
  type SectionKey,
} from "./report-actions";

export interface ReportSectionDefinition {
  key: SectionKey;
  label: string;
  hint: string;
  required: boolean;
}

export interface ReportPanelState {
  values: ReportSectionValues;
  validatedAt: string | null;
  sentAt: string | null;
  sentTo: string[];
  pdfUrl: string | null;
  origin: string;
  regenerations: number;
}

/**
 * Compte-rendu d'intervention.
 *
 * Le parcours du §17, dans l'ordre : générer un brouillon, corriger section
 * par section, valider, envoyer. Le verrou est structurel — le bouton
 * d'envoi n'apparaît qu'après validation, et toute modification ultérieure
 * fait retomber le rapport à l'état de brouillon.
 */
export function ReportPanel({
  interventionId,
  sections,
  initial,
  readOnly,
  aiLive,
  redactionAssistee,
  envoiAutorise,
  customerEmail,
}: {
  interventionId: string;
  sections: ReportSectionDefinition[];
  initial: ReportPanelState;
  readOnly: boolean;
  aiLive: boolean;
  /** Offre couvrant la rédaction assistée : sinon le bouton n'existe pas. */
  redactionAssistee: boolean;
  /** Offre couvrant l'envoi au client. */
  envoiAutorise: boolean;
  customerEmail: string | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ReportSectionValues>(initial.values);
  const [state, setState] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const [saving, startSaving] = useTransition();
  const [sendOpen, setSendOpen] = useState(false);
  const [regenerating, startRegenerating] = useTransition();

  /**
   * Réaligne sur le serveur ce qui ne s'écrit pas ici.
   *
   * Le PDF, la validation et l'envoi peuvent changer sans passer par ce
   * panneau : signer régénère le rapport et jette le fichier précédent. Sans
   * cette remise à niveau, le composant continuait d'afficher « Rapport PDF
   * prêt » avec le lien de l'ancien fichier, effacé entre-temps — d'où un
   * téléchargement introuvable alors que la liste des documents, elle,
   * montrait le bon.
   *
   * L'ajustement se fait pendant le rendu, et non dans un effet : c'est le
   * motif recommandé pour recaler un état sur une propriété qui a changé, et
   * il évite un rendu intermédiaire avec l'ancienne valeur. Les textes en
   * cours de saisie ne sont pas touchés — seuls les champs que le serveur
   * possède le sont.
   */
  const [serveur, setServeur] = useState(initial);
  if (serveur !== initial) {
    setServeur(initial);
    setState((s) => ({
      ...s,
      pdfUrl: initial.pdfUrl,
      validatedAt: initial.validatedAt,
      sentAt: initial.sentAt,
      sentTo: initial.sentTo,
    }));
  }

  const busy = generating || saving;
  const validated = Boolean(state.validatedAt) && !dirty;
  const empty = Object.values(values).every((v) => !v.trim());

  function set(key: SectionKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  /**
   * Refabrique le PDF d'un rapport déjà validé.
   *
   * Disponible même sur une intervention close : régénérer n'écrit rien dans
   * le compte-rendu, cela réimprime ce qui a été validé.
   */
  function regenerate() {
    setFormError(null);
    startRegenerating(async () => {
      const result = await regenerateReportPdfAction(interventionId);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setState((s) => ({ ...s, pdfUrl: result.data.pdfUrl }));
      toast.success("PDF régénéré.");
      router.refresh();
    });
  }

  function generate() {
    setFormError(null);
    startGenerating(async () => {
      const result = await generateReportAction(interventionId);
      if (result.ok) {
        const { provider, ...next } = result.data;
        setValues(next);
        setDirty(false);
        setState((s) => ({
          ...s,
          validatedAt: null,
          regenerations: s.regenerations + 1,
        }));
        toast.success(
          provider === "mock"
            ? "Brouillon assemblé à partir de vos notes."
            : "Brouillon rédigé. Relisez-le avant de valider.",
        );
        router.refresh();
      } else {
        setFormError(result.error);
        toast.error(result.error);
      }
    });
  }

  function save() {
    setFormError(null);
    startSaving(async () => {
      const result = await saveReportAction(interventionId, values);
      if (result.ok) {
        setDirty(false);
        setState((s) => ({ ...s, validatedAt: null }));
        toast.success("Compte-rendu enregistré.");
      } else {
        setFormError(result.error);
      }
    });
  }

  function validate() {
    setFormError(null);
    startSaving(async () => {
      const result = await validateReportAction(interventionId, values);
      if (result.ok) {
        setDirty(false);
        setState((s) => ({
          ...s,
          validatedAt: new Date().toISOString(),
          pdfUrl: result.data.pdfUrl,
        }));
        toast.success("Compte-rendu validé, PDF généré.");
        router.refresh();
      } else {
        setFormError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-muted-foreground" />
            Compte-rendu
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {validated ? (
              <span className="inline-flex items-center gap-1.5 text-status-done">
                <Check className="size-3.5" />
                Validé le {formatDateTime(state.validatedAt!)}
              </span>
            ) : dirty ? (
              "Modifications non enregistrées"
            ) : empty ? (
              "Aucun compte-rendu"
            ) : (
              "Brouillon — à relire et valider"
            )}
          </p>
        </div>

        {!readOnly && redactionAssistee && (
          <Button
            type="button"
            variant={empty ? "default" : "outline"}
            onClick={generate}
            disabled={busy}
            className="h-11 gap-1.5"
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : empty ? (
              <Sparkles className="size-4" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {empty ? "Rédiger le brouillon" : "Régénérer"}
          </Button>
        )}
      </div>

      <FormError message={formError} />

      {!aiLive && !readOnly && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-brand/25 bg-brand-subtle px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            Aucun modèle de rédaction n&apos;est configuré : le brouillon est
            assemblé mécaniquement à partir de vos notes, anomalies et photos.
            Relisez-le avec d&apos;autant plus d&apos;attention.
          </span>
        </p>
      )}

      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.key}>
            <label
              htmlFor={`section-${section.key}`}
              className="flex flex-wrap items-baseline gap-2 text-sm font-medium"
            >
              {section.label}
              {section.required && <span className="text-destructive">*</span>}
              <span className="text-xs font-normal text-muted-foreground">
                {section.hint}
              </span>
            </label>
            {readOnly ? (
              <p className="mt-1.5 text-sm whitespace-pre-wrap">
                {values[section.key] || "—"}
              </p>
            ) : (
              <Textarea
                id={`section-${section.key}`}
                value={values[section.key]}
                onChange={(e) => set(section.key, e.target.value)}
                rows={section.key === "summary" ? 3 : 4}
                className={cn("mt-1.5", dirty && "border-brand/50")}
              />
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
          <Button
            type="button"
            onClick={validate}
            disabled={busy || empty}
            className="h-11 gap-1.5"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {validated ? "Revalider et régénérer le PDF" : "Valider le compte-rendu"}
          </Button>

          {dirty && (
            <Button
              type="button"
              variant="outline"
              onClick={save}
              disabled={busy}
              className="h-11"
            >
              Enregistrer sans valider
            </Button>
          )}
        </div>
      )}

      {state.validatedAt && !state.pdfUrl && !dirty && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3.5">
          <TriangleAlert className="size-4 shrink-0 text-severity-medium" />
          <span className="text-sm">
            Le PDF de ce rapport n&apos;est plus disponible.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={regenerate}
            disabled={regenerating}
            className="ml-auto gap-1.5"
          >
            {regenerating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Régénérer le PDF
          </Button>
        </div>
      )}

      {state.pdfUrl && validated && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-3.5">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm">Rapport PDF prêt</span>

          <div className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={state.pdfUrl} target="_blank" rel="noreferrer noopener">
                <Download className="size-4" />
                Télécharger
              </a>
            </Button>
            {envoiAutorise ? (
              <Button
                size="sm"
                onClick={() => setSendOpen(true)}
                className="gap-1.5"
              >
                <Mail className="size-4" />
                Envoyer au client
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" />
                Envoi par e-mail : offre Pro
              </span>
            )}
          </div>

          {state.sentAt && (
            <p className="w-full text-xs text-muted-foreground">
              Déjà envoyé le {formatDateTime(state.sentAt)}
              {state.sentTo.length > 0 && ` à ${state.sentTo.join(", ")}`}
            </p>
          )}
        </div>
      )}

      {!validated && !empty && !readOnly && (
        <p className="mt-4 text-sm text-muted-foreground text-pretty">
          Le rapport ne peut être envoyé au client qu&apos;après votre
          validation.
        </p>
      )}

      {sendOpen && (
        <SendDialog
          interventionId={interventionId}
          defaultEmail={customerEmail}
          onClose={() => setSendOpen(false)}
          onSent={(to) =>
            setState((s) => ({
              ...s,
              sentAt: new Date().toISOString(),
              sentTo: [...s.sentTo, to],
            }))
          }
        />
      )}
    </section>
  );
}

function SendDialog({
  interventionId,
  defaultEmail,
  onClose,
  onSent,
}: {
  interventionId: string;
  defaultEmail: string | null;
  onClose: () => void;
  onSent: (to: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  function onSubmit(formData: FormData) {
    setErrors({});
    startTransition(async () => {
      const result = await sendReportAction(interventionId, formData);
      if (result.ok) {
        toast.success(
          result.data.driver === "console"
            ? "Envoi simulé — voir la console du serveur."
            : `Rapport envoyé à ${result.data.sentTo}.`,
        );
        onSent(result.data.sentTo);
        onClose();
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        if (!result.fieldErrors) toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Envoyer le rapport au client</DialogTitle>
          <DialogDescription className="text-pretty">
            Le PDF validé part en pièce jointe. Le message ci-dessous
            l&apos;accompagne.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4" noValidate>
          <TextField
            name="to"
            label="Adresse du client"
            type="email"
            inputMode="email"
            required
            defaultValue={defaultEmail ?? ""}
            error={errors.to?.[0]}
          />
          <TextAreaField
            name="message"
            label="Message"
            rows={3}
            placeholder="Laisser vide pour le texte standard."
            error={errors.message?.[0]}
          />

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending ? (
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
  );
}
