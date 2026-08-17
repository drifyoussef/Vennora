"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PenLine, PlayCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormError, TextField } from "@/components/vennora/form";
import { formatDateTime } from "@/lib/format";
import { saveSignatureAction } from "./signature-actions";

/**
 * Signature manuscrite du client.
 *
 * Canvas piloté aux Pointer Events plutôt qu'aux événements souris et tactiles
 * séparés : un seul chemin de code couvre le doigt, le stylet et la souris.
 *
 * Le canvas est dimensionné en pixels physiques (`devicePixelRatio`) — sans
 * ça, un trait tracé sur un écran Retina ressort crénelé dans le PDF, où il
 * est agrandi.
 *
 * Le cadre est blanc dans les deux thèmes, et l'encre toujours sombre : c'est
 * une feuille de papier, et c'est exactement ce qui finit dans le PDF.
 */

/** Encre du tracé. Identique à celle du PDF, donc jamais dépendante du thème. */
const INK = "#17282e";

export function SignaturePad({
  interventionId,
  existing,
  readOnly,
}: {
  interventionId: string;
  existing: { signerName: string; signedAt: Date } | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [signed, setSigned] = useState(existing);

  /**
   * (Re)dimensionne le canvas au pixel physique.
   *
   * Réaffecter `width` ou `height` vide le bitmap : sans la sauvegarde
   * ci-dessous, une rotation du téléphone — ou la barre d'URL d'iOS qui se
   * rétracte — effacerait une signature en cours.
   */
  const prepare = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width === width && canvas.height === height) return;

    const previous =
      canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL() : null;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;

    if (previous) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = previous;
    }
  }, []);

  useEffect(() => {
    if (readOnly) return;
    prepare();
    window.addEventListener("resize", prepare);
    window.addEventListener("orientationchange", prepare);
    return () => {
      window.removeEventListener("resize", prepare);
      window.removeEventListener("orientationchange", prepare);
    };
  }, [prepare, readOnly]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    // Empêche le défilement de la page pendant qu'on signe au doigt.
    event.preventDefault();
    const ctx = event.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFrom(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }

  function end() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // Le contexte est mis à l'échelle : on remet la transformation à
    // l'identité le temps d'effacer, sinon on ne nettoie qu'une partie.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
  }

  function onSubmit(formData: FormData) {
    setErrors({});
    setFormError(null);

    const canvas = canvasRef.current;
    if (!canvas || !hasInk) {
      setFormError("Faites signer le client dans le cadre ci-dessus.");
      return;
    }

    formData.set("image", canvas.toDataURL("image/png"));

    startTransition(async () => {
      const result = await saveSignatureAction(interventionId, formData);
      if (result.ok) {
        toast.success("Signature enregistrée.");
        setSigned({
          signerName: result.data.signerName,
          signedAt: new Date(result.data.signedAt),
        });
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? null : result.error);
        if (!result.fieldErrors) toast.error(result.error);
      }
    });
  }

  /**
   * En lecture seule, on n'affiche jamais le cadre de signature.
   *
   * Un cadre qui a l'air d'attendre un trait mais n'en accepte aucun est pire
   * qu'un cadre absent : le technicien signe, rien n'apparaît, et rien ne lui
   * dit pourquoi. Les autres panneaux du terrain masquent déjà leurs
   * contrôles de la même façon.
   */
  if (readOnly) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <PenLine className="size-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-semibold">
            Signature du client
          </h2>
        </div>

        {signed ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Check className="size-4 shrink-0 text-status-done" />
            Signé par <strong>{signed.signerName}</strong> le{" "}
            {formatDateTime(signed.signedAt)}
          </p>
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground text-pretty">
            <PlayCircle className="mt-0.5 size-4 shrink-0" />
            <span>
              Démarrez l&apos;intervention pour faire signer le client. La
              signature se recueille une fois le travail effectué et le
              compte-rendu rédigé.
            </span>
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <PenLine className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-base font-semibold">
          Signature du client
        </h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground text-pretty">
        Le client confirme la réalisation de l&apos;intervention. La date,
        l&apos;heure et l&apos;adresse IP sont enregistrées avec la signature.
      </p>

      {signed && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-status-done/10 px-3 py-2 text-sm text-status-done">
          <Check className="size-4" />
          Déjà signé par {signed.signerName} le {formatDateTime(signed.signedAt)}.
          Signer à nouveau remplacera cette signature.
        </p>
      )}

      <form action={onSubmit} className="space-y-4" noValidate>
        <FormError message={formError} />

        <div>
          <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-input bg-white">
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              onPointerCancel={end}
              className="h-44 w-full touch-none"
              aria-label="Zone de signature"
            />
            {!hasInk && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                Signez ici
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={!hasInk || pending}
            className="mt-2 gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Effacer
          </Button>
        </div>

        <TextField
          name="signerName"
          label="Nom du signataire"
          required
          defaultValue={signed?.signerName}
          error={errors.signerName?.[0]}
          autoComplete="off"
          className="max-w-sm"
        />

        <Button type="submit" disabled={pending} className="h-11 gap-1.5">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Valider la signature
        </Button>
      </form>
    </section>
  );
}
