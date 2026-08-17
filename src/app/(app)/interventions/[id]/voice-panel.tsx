"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Loader2, Mic, Square, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addVoiceNoteAction,
  deleteVoiceNoteAction,
  updateTranscriptAction,
  type VoiceNoteDto,
} from "./voice-actions";

/**
 * Dictée du technicien.
 *
 * `MediaRecorder` avec le premier type MIME supporté par le navigateur :
 * Chrome et Firefox produisent du WebM/Opus, Safari du MP4/AAC. On n'impose
 * rien — le serveur accepte les deux et détermine le format par la signature
 * binaire.
 *
 * Le texte transcrit est modifiable, comme l'exige le §16 : une transcription
 * est une aide à la saisie, pas une source de vérité.
 */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Compteur d'enregistrement : « 1:07 ». */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function VoicePanel({
  interventionId,
  initial,
  readOnly,
  transcriptionLive,
}: {
  interventionId: string;
  initial: VoiceNoteDto[];
  readOnly: boolean;
  transcriptionLive: boolean;
}) {
  const [notes, setNotes] = useState<VoiceNoteDto[]>(initial);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  /** Compteur de secondes, lisible depuis `onstop` sans horloge. */
  const elapsedRef = useRef(0);

  /**
   * Détection de capacité via `useSyncExternalStore` : le rendu serveur
   * répond « non supporté » et le client corrige à l'hydratation, sans effet
   * ni second rendu en cascade.
   */
  const supported = useSyncExternalStore(
    () => () => {},
    () =>
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined",
    () => false,
  );

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [recording]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];

      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };

      rec.onstop = async () => {
        // Le micro reste actif tant que les pistes ne sont pas coupées :
        // sans ça, le voyant d'enregistrement reste allumé sur le téléphone.
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(chunks.current, {
          type: rec.mimeType || "audio/webm",
        });
        await upload(blob, elapsedRef.current);
      };

      elapsedRef.current = 0;
      setElapsed(0);
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      toast.error(
        "Micro inaccessible. Vérifiez l'autorisation dans les réglages du navigateur.",
      );
    }
  }

  function stop() {
    recorder.current?.stop();
    recorder.current = null;
    setRecording(false);
  }

  async function upload(blob: Blob, durationSec: number) {
    if (blob.size === 0) return;
    setUploading(true);

    const form = new FormData();
    const extension = blob.type.includes("mp4") ? "m4a" : "webm";
    form.append("file", blob, `dictee.${extension}`);
    form.append("durationSec", String(durationSec));

    const result = await addVoiceNoteAction(interventionId, form);
    setUploading(false);

    if (result.ok) {
      setNotes((current) => [...current, result.data]);
      if (result.data.transcriptStatus === "FAILED") {
        toast.warning("Enregistrement conservé, mais la transcription a échoué.");
      } else {
        toast.success("Note vocale enregistrée.");
      }
    } else {
      toast.error(result.error);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">
          Dictée
          {notes.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {notes.length}
            </span>
          )}
        </h2>

        {!readOnly && supported && (
          <Button
            type="button"
            onClick={recording ? stop : start}
            disabled={uploading}
            variant={recording ? "destructive" : "default"}
            className="h-11 gap-2"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : recording ? (
              <Square className="size-4" />
            ) : (
              <Mic className="size-4" />
            )}
            {uploading
              ? "Traitement…"
              : recording
                ? `Arrêter · ${clock(elapsed)}`
                : "Dicter"}
          </Button>
        )}
      </div>

      {!supported && (
        <p className="mb-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
          Ce navigateur ne permet pas l&apos;enregistrement audio. Saisissez vos
          observations dans les notes.
        </p>
      )}

      {!transcriptionLive && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-brand/25 bg-brand-subtle px-3 py-2.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            Aucun service de reconnaissance vocale n&apos;est configuré :
            l&apos;audio est bien enregistré, mais le texte doit être saisi à la
            main.
          </span>
        </p>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {readOnly
            ? "Aucune note vocale."
            : "Dictez vos observations plutôt que de les taper : le texte alimente le compte-rendu."}
        </p>
      ) : (
        <ul className="space-y-4">
          {notes.map((note) => (
            <VoiceNoteItem
              key={note.id}
              note={note}
              readOnly={readOnly}
              onDelete={() =>
                setNotes((current) => current.filter((n) => n.id !== note.id))
              }
              onTranscript={(text) =>
                setNotes((current) =>
                  current.map((n) =>
                    n.id === note.id ? { ...n, transcript: text } : n,
                  ),
                )
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function VoiceNoteItem({
  note,
  readOnly,
  onDelete,
  onTranscript,
}: {
  note: VoiceNoteDto;
  readOnly: boolean;
  onDelete: () => void;
  onTranscript: (text: string) => void;
}) {
  const [text, setText] = useState(note.transcript ?? "");
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  function save() {
    startTransition(async () => {
      const result = await updateTranscriptAction(note.id, text);
      if (result.ok) {
        onTranscript(text);
        setDirty(false);
        toast.success("Texte enregistré.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteVoiceNoteAction(note.id);
      if (result.ok) {
        toast.success("Note supprimée.");
        onDelete();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <li className="rounded-lg border border-border p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <audio
          controls
          preload="none"
          src={note.url}
          className="h-9 min-w-0 flex-1"
        />
        {note.durationSec && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {note.durationSec} s
          </span>
        )}
        {!readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={remove}
            disabled={pending}
            aria-label="Supprimer la note vocale"
            className="size-9 shrink-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {note.transcriptStatus === "FAILED" && (
        <p className="mt-2 text-sm text-severity-high">
          La transcription automatique a échoué. Saisissez le texte ci-dessous.
        </p>
      )}

      {readOnly ? (
        text && <p className="mt-2 text-sm whitespace-pre-wrap">{text}</p>
      ) : (
        <div className="mt-2 space-y-2">
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            rows={3}
            placeholder="Transcription — corrigez-la si nécessaire."
            className={cn(dirty && "border-brand")}
          />
          {dirty && (
            <Button size="sm" onClick={save} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Enregistrer le texte
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
