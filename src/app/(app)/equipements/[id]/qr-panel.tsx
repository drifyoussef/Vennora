"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { regenerateQrTokenAction } from "../actions";

/**
 * Étiquette QR de l'équipement.
 *
 * Le SVG est rendu côté serveur et passé en chaîne : générer un QR code dans
 * le navigateur imposerait d'embarquer la bibliothèque dans le bundle pour un
 * usage qui ne concerne qu'un écran sur vingt.
 *
 * L'impression ouvre une fenêtre dédiée plutôt que d'appliquer une feuille
 * `@media print` à la page entière : on veut une étiquette autocollante,
 * pas la fiche complète.
 */
export function QrPanel({
  equipmentId,
  svg,
  url,
  title,
  subtitle,
  canRegenerate,
}: {
  equipmentId: string;
  svg: string;
  url: string;
  title: string;
  subtitle: string;
  canRegenerate: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function print() {
    const win = window.open("", "_blank", "width=520,height=680");
    if (!win) {
      toast.error("Autorisez les fenêtres surgissantes pour imprimer.");
      return;
    }

    win.document.write(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 12mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0F3D4C;
         display: flex; align-items: center; justify-content: center; min-height: 90vh; margin: 0; }
  .label { border: 2px solid #0F3D4C; border-radius: 10px; padding: 18px; width: 74mm; text-align: center; }
  .brand { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #6B7780; }
  .title { font-size: 15px; font-weight: 600; margin: 8px 0 2px; }
  .subtitle { font-size: 12px; color: #6B7780; margin-bottom: 12px; }
  svg { width: 100%; height: auto; }
  .hint { font-size: 10px; color: #6B7780; margin-top: 10px; }
</style></head>
<body><div class="label">
  <div class="brand">Vennora</div>
  <div class="title">${escapeHtml(title)}</div>
  <div class="subtitle">${escapeHtml(subtitle)}</div>
  ${svg}
  <div class="hint">Scannez pour accéder à l'historique</div>
</div></body></html>`);

    win.document.close();
    win.focus();
    // Laisse le SVG se disposer avant d'ouvrir la boîte d'impression.
    setTimeout(() => win.print(), 250);
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateQrTokenAction(equipmentId);
      if (result.ok) {
        toast.success("Nouveau QR code généré. L'ancienne étiquette est caduque.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <QrCode className="size-4" />
          QR code
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code de l&apos;équipement</DialogTitle>
          <DialogDescription className="text-pretty">
            Collez cette étiquette sur l&apos;appareil. Un technicien connecté
            qui la scanne arrive directement sur l&apos;historique.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-white p-4">
          <div
            className="mx-auto w-full max-w-56 [&_svg]:h-auto [&_svg]:w-full"
            // Sortie de la bibliothèque QR, pas une saisie utilisateur.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        <p className="text-center font-mono text-[11px] break-all text-muted-foreground">
          {url}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={print} className="flex-1 gap-1.5">
            <Printer className="size-4" />
            Imprimer
          </Button>
          {canRegenerate && (
            <Button
              variant="outline"
              onClick={regenerate}
              disabled={pending}
              className="gap-1.5"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Régénérer
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
