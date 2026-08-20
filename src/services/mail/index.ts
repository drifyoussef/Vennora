import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/core/errors";
import type { MailMessage, MailResult } from "./types";

/**
 * Envoi d'e-mails.
 *
 * Deux pilotes : « console » en développement, qui journalise le message au
 * lieu de l'envoyer, et « smtp » en production, via nodemailer. Le pilote
 * console est le défaut — envoyer de vrais e-mails à de vrais clients depuis
 * une machine de développement est le genre d'accident qu'on ne rattrape pas.
 *
 * L'adaptateur SMTP est importé à la demande : sans configuration, nodemailer
 * n'entre pas dans la sortie serveur.
 */
async function sendViaConsole(message: MailMessage): Promise<MailResult> {
  console.info(
    [
      "",
      "──────── E-MAIL NON ENVOYÉ (MAIL_DRIVER=console) ────────",
      "Ce message n'est pas parti. Pour l'expédier réellement :",
      "MAIL_DRIVER=\"smtp\" dans .env, puis redémarrer le serveur.",
      "──────────────────────────────────────────────────────────",
      `À        : ${message.to.join(", ")}`,
      `Objet    : ${message.subject}`,
      message.replyTo ? `Répondre : ${message.replyTo}` : null,
      message.attachments?.length
        ? `Pièces   : ${message.attachments.map((a) => `${a.filename} (${a.content.length} o)`).join(", ")}`
        : null,
      "─────────────────────────────────────────────────",
      message.text,
      "─────────────────────────────────────────────────",
      "",
    ]
      .filter((l) => l !== null)
      .join("\n"),
  );
  return { driver: "console", id: null };
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (message.to.length === 0) {
    throw new AppError("Aucun destinataire.", "MAIL_NO_RECIPIENT", 422);
  }

  console.info(
    `[vennora] envoi d'e-mail — pilote ${env.MAIL_DRIVER} · ${message.to.join(", ")}` +
      ` · objet « ${message.subject} »` +
      (message.attachments?.length
        ? ` · ${message.attachments.length} pièce(s) jointe(s)`
        : ""),
  );

  if (env.MAIL_DRIVER === "smtp") {
    const { sendViaSmtp } = await import("./smtp");
    return sendViaSmtp(message);
  }
  return sendViaConsole(message);
}

export const mailIsLive = env.MAIL_DRIVER !== "console";

export type { MailAttachment, MailMessage, MailResult } from "./types";
