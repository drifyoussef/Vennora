"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Camera, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/image";
import { formatSize } from "@/lib/bytes";
import { cn } from "@/lib/utils";
import {
  addPhotoAction,
  deletePhotoAction,
  updatePhotoCaptionAction,
  type PhotoDto,
} from "./photo-actions";

/**
 * Galerie de photos du terrain.
 *
 * Deux entrées distinctes : « Prendre une photo » ouvre directement l'appareil
 * grâce à l'attribut `capture`, « Choisir » ouvre la pellicule. Les fusionner
 * imposerait au technicien un menu intermédiaire à chaque cliché, alors que
 * prendre la photo est le geste de loin le plus fréquent.
 *
 * Les envois sont séquentiels et l'état est optimiste : on voit la vignette
 * apparaître pendant que l'envoi se termine, ce qui compte quand on est en 4G
 * dans une cave.
 */
export function PhotoPanel({
  interventionId,
  initial,
  readOnly,
}: {
  interventionId: string;
  initial: PhotoDto[];
  readOnly: boolean;
}) {
  const [photos, setPhotos] = useState<PhotoDto[]>(initial);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [preview, setPreview] = useState<PhotoDto | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    const list = [...files];
    setUploading({ done: 0, total: list.length });

    for (const [index, file] of list.entries()) {
      try {
        const compressed = await compressImage(file);
        const form = new FormData();
        form.append(
          "file",
          compressed.blob,
          file.name.replace(/\.[^.]+$/, "") + ".jpg",
        );

        const result = await addPhotoAction(interventionId, form);
        if (result.ok) {
          setPhotos((current) => [...current, result.data]);
        } else {
          toast.error(`${file.name} — ${result.error}`);
        }
      } catch {
        toast.error(`${file.name} — envoi impossible.`);
      }
      setUploading({ done: index + 1, total: list.length });
    }

    setUploading(null);
    if (cameraRef.current) cameraRef.current.value = "";
    if (libraryRef.current) libraryRef.current.value = "";
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">
          Photos
          {photos.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              {photos.length}
            </span>
          )}
        </h2>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => upload(e.target.files)}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => upload(e.target.files)}
            />
            <Button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={Boolean(uploading)}
              className="h-11 gap-1.5"
            >
              <Camera className="size-4" />
              Prendre une photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => libraryRef.current?.click()}
              disabled={Boolean(uploading)}
              className="h-11 gap-1.5"
            >
              <ImagePlus className="size-4" />
              Choisir
            </Button>
          </div>
        )}
      </div>

      {uploading && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Envoi {uploading.done} sur {uploading.total}…
        </p>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Aucune photo n'a été prise lors de cette intervention."
            : "Aucune photo pour l'instant. Les clichés apparaîtront dans le rapport remis au client."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative">
              <button
                type="button"
                onClick={() => setPreview(photo)}
                className="block w-full overflow-hidden rounded-lg border border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? "Photo d'intervention"}
                  width={320}
                  height={320}
                  unoptimized
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              </button>
              {photo.caption && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {photo.caption}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <PhotoDialog
          photo={preview}
          readOnly={readOnly}
          onClose={() => setPreview(null)}
          onCaption={(caption) =>
            setPhotos((current) =>
              current.map((p) => (p.id === preview.id ? { ...p, caption } : p)),
            )
          }
          onDelete={() => {
            setPhotos((current) => current.filter((p) => p.id !== preview.id));
            setPreview(null);
          }}
        />
      )}
    </section>
  );
}

/**
 * Aperçu plein écran.
 *
 * Écrit à la main plutôt qu'avec le composant Dialog : on veut une image
 * plein cadre sur fond sombre, sans la carte blanche et les marges d'une
 * boîte de dialogue classique.
 */
function PhotoDialog({
  photo,
  readOnly,
  onClose,
  onCaption,
  onDelete,
}: {
  photo: PhotoDto;
  readOnly: boolean;
  onClose: () => void;
  onCaption: (caption: string | null) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updatePhotoCaptionAction(photo.id, caption);
      if (result.ok) {
        onCaption(caption.trim() || null);
        toast.success("Légende enregistrée.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deletePhotoAction(photo.id);
      if (result.ok) {
        toast.success("Photo supprimée.");
        onDelete();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu de la photo"
      className="fixed inset-0 z-50 flex flex-col bg-black/92 backdrop-blur-sm"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="pt-safe flex justify-end p-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Fermer"
          className="touch-target text-white hover:bg-white/15 hover:text-white"
        >
          <X className="size-5" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <Image
          src={photo.url}
          alt={photo.caption ?? "Photo d'intervention"}
          width={1600}
          height={1600}
          unoptimized
          className="max-h-full w-auto max-w-full object-contain"
        />
      </div>

      <div className="pb-safe space-y-3 p-4">
        <p className="text-xs text-white/50">
          {formatSize(photo.sizeBytes)} · ajoutée le{" "}
          {new Date(photo.createdAt).toLocaleString("fr-FR")}
        </p>

        {readOnly ? (
          photo.caption && <p className="text-sm text-white">{photo.caption}</p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Légende (visible dans le rapport)"
                maxLength={300}
                className={cn(
                  "h-11 border-white/25 bg-white/10 text-white",
                  "placeholder:text-white/40",
                )}
              />
              <Button onClick={save} disabled={pending} className="h-11">
                {pending && <Loader2 className="size-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={remove}
              disabled={pending}
              className="h-11 gap-1.5 text-destructive hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Supprimer la photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
