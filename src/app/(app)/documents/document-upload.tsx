"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormError, SelectField, TextField } from "@/components/vennora/form";
import { DOCUMENT_CATEGORY_LABEL } from "@/core/labels";
import { DocumentCategory } from "@/core/enums";
import { formatSize } from "@/lib/bytes";
import { deleteDocumentAction, uploadDocumentAction } from "./actions";

const CATEGORIES = [
  DocumentCategory.QUOTE,
  DocumentCategory.INVOICE,
  DocumentCategory.CERTIFICATE,
  DocumentCategory.PHOTO,
  DocumentCategory.OTHER,
];

/**
 * Téléversement d'un document.
 *
 * Le rattachement est obligatoire : un document flottant, sans client ni
 * équipement, ne se retrouve jamais. La liste des clients est envoyée avec la
 * page — quelques centaines de lignes valent mieux qu'un aller-retour à
 * chaque ouverture de la boîte de dialogue.
 */
export function DocumentUpload({
  customers,
  presetCustomerId,
}: {
  customers: Array<{ id: string; name: string }>;
  presetCustomerId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(formData: FormData) {
    setFormError(null);

    if (!file) {
      setFormError("Choisissez un fichier.");
      return;
    }
    formData.set("file", file);

    startTransition(async () => {
      const result = await uploadDocumentAction(formData);
      if (result.ok) {
        toast.success("Document ajouté.");
        setOpen(false);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFile(null);
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Upload className="size-4" />
          Ajouter un document
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
          <DialogDescription className="text-pretty">
            Devis, facture, certificat ou photo. Formats acceptés : PDF, JPEG,
            PNG, WebP, HEIC.
          </DialogDescription>
        </DialogHeader>

        <form action={onSubmit} className="space-y-4" noValidate>
          <FormError message={formError} />

          <div>
            <label
              htmlFor="document-file"
              className="text-sm leading-none font-medium"
            >
              Fichier <span className="text-destructive">*</span>
            </label>
            <input
              id="document-file"
              ref={inputRef}
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-accent"
            />
            {file && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {file.name} · {formatSize(file.size)}
              </p>
            )}
          </div>

          <TextField
            name="name"
            label="Nom affiché"
            hint="Laisser vide pour reprendre le nom du fichier."
          />

          <SelectField
            name="category"
            label="Catégorie"
            defaultValue={DocumentCategory.OTHER}
            options={CATEGORIES.map((c) => ({
              value: c,
              label: DOCUMENT_CATEGORY_LABEL[c],
            }))}
          />

          {presetCustomerId ? (
            <input type="hidden" name="customerId" value={presetCustomerId} />
          ) : (
            <SelectField
              name="customerId"
              label="Client"
              required
              placeholder="Choisir un client…"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDocument({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Supprimer ${name}`}
      disabled={pending}
      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
      onClick={() =>
        startTransition(async () => {
          const result = await deleteDocumentAction(id);
          if (result.ok) {
            toast.success("Document supprimé.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </Button>
  );
}
