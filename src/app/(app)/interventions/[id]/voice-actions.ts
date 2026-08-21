"use server";

import { revalidatePath } from "next/cache";

import { getActionContext } from "@/core/context";
import { exigerFonctionnalite } from "@/core/plans";
import { requireEditableIntervention } from "@/core/data/field";
import { TranscriptStatus } from "@/core/enums";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import { objectId } from "@/core/schemas";
import { audit } from "@/core/tenant";
import { getTranscriptionProvider, transcriptionIsLive } from "@/services/ai";
import { deleteFile, fileUrl, storeFile } from "@/services/storage";
import { getTrade } from "@/verticals/registry";

export interface VoiceNoteDto {
  id: string;
  url: string;
  durationSec: number | null;
  transcript: string | null;
  transcriptStatus: string;
  transcriptEdited: boolean;
  createdAt: string;
}

/**
 * Enregistre une note vocale et lance sa transcription.
 *
 * Transcription synchrone : une dictée de chantier fait une à deux minutes,
 * la transcription prend quelques secondes, et le technicien attend de toute
 * façon le résultat pour le relire. Une file d'attente ajouterait de
 * l'infrastructure sans rien gagner à cette échelle.
 *
 * Un échec de transcription ne perd jamais l'audio : la note est créée
 * d'abord, le statut passe à FAILED, et le technicien peut réécouter.
 */
export async function addVoiceNoteAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<VoiceNoteDto>> {
  try {
    const context = await getActionContext("intervention.update");
    // La note vocale n'a d'intérêt que transcrite : la garde est ici, à
    // l'entrée, plutôt qu'après avoir stocké un fichier audio inexploitable.
    exigerFonctionnalite(context, "redaction-assistee");
    const { db, ctx, user } = context;
    const id = objectId.parse(interventionId);

    await requireEditableIntervention(context, id);

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, code: "VALIDATION", error: "Aucun enregistrement reçu." };
    }

    const rawDuration = Number(formData.get("durationSec"));
    const durationSec =
      Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.round(rawDuration)
        : null;

    const body = Buffer.from(await file.arrayBuffer());
    const stored = await storeFile(
      {
        orgId: ctx.orgId,
        scope: "notes-vocales",
        ownerId: id,
        body,
        contentType: file.type,
      },
      ["audio"],
    );

    let note;
    try {
      note = await db.voiceNote.create({
        data: {
          orgId: ctx.orgId,
          interventionId: id,
          storageKey: stored.key,
          mimeType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          durationSec,
          transcriptStatus: TranscriptStatus.PROCESSING,
          createdById: user.id,
        },
        select: { id: true, createdAt: true },
      });
    } catch (e) {
      await deleteFile(stored.key);
      throw e;
    }

    // Vocabulaire métier transmis au service : « débistrage » et « boisseau »
    // ne sont pas dans le vocabulaire courant d'un modèle généraliste.
    const trade = getTrade(user.org.tradeSlug);
    const vocabulary = [
      ...trade.equipmentTypes.map((t) => t.label),
      ...trade.interventionTypes.map((t) => t.label),
      "conduit",
      "boisseau",
      "débistrage",
      "tubage",
      "tirage",
      "chapeau",
      "trappe de ramonage",
    ];

    let transcript: string | null = null;
    let status: TranscriptStatus = TranscriptStatus.DONE;
    let error: string | null = null;

    try {
      const provider = await getTranscriptionProvider();
      const result = await provider.transcribe({
        audio: body,
        mimeType: stored.contentType,
        language: "fr",
        vocabulary,
      });
      transcript = result.text;
      if (!transcriptionIsLive) status = TranscriptStatus.DONE;
    } catch (e) {
      status = TranscriptStatus.FAILED;
      error = e instanceof Error ? e.message : "Transcription impossible.";
    }

    await db.voiceNote.updateMany({
      where: { id: note.id },
      data: { transcript, transcriptStatus: status, transcriptError: error },
    });

    await audit(ctx, {
      action: "voiceNote.added",
      entity: "VoiceNote",
      entityId: note.id,
      metadata: { interventionId: id, status },
    });

    revalidatePath(`/interventions/${id}`);

    return {
      ok: true,
      data: {
        id: note.id,
        url: await fileUrl(stored.key),
        durationSec,
        transcript,
        transcriptStatus: status,
        transcriptEdited: false,
        createdAt: note.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Corrige la transcription.
 *
 * Le §16 l'exige : le technicien doit pouvoir modifier le texte. On marque
 * la note comme éditée, pour qu'on sache plus tard qu'un humain est passé.
 */
export async function updateTranscriptAction(
  voiceNoteId: string,
  transcript: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db } = context;
    const id = objectId.parse(voiceNoteId);

    const note = await db.voiceNote.findFirst({
      where: { id },
      select: { id: true, interventionId: true },
    });
    if (!note) throw new NotFoundError("Note vocale");

    await requireEditableIntervention(context, note.interventionId);

    await db.voiceNote.updateMany({
      where: { id },
      data: {
        transcript: transcript.trim().slice(0, 8000) || null,
        transcriptStatus: TranscriptStatus.DONE,
        transcriptEdited: true,
        transcriptError: null,
      },
    });

    revalidatePath(`/interventions/${note.interventionId}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteVoiceNoteAction(
  voiceNoteId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await getActionContext("intervention.update");
    const { db } = context;
    const id = objectId.parse(voiceNoteId);

    const note = await db.voiceNote.findFirst({
      where: { id },
      select: { id: true, interventionId: true, storageKey: true },
    });
    if (!note) throw new NotFoundError("Note vocale");

    await requireEditableIntervention(context, note.interventionId);

    await db.voiceNote.deleteMany({ where: { id } });
    await deleteFile(note.storageKey);

    revalidatePath(`/interventions/${note.interventionId}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return toActionError(e);
  }
}
