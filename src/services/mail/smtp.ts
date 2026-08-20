import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { AppError } from "@/core/errors";
import type { MailMessage, MailResult } from "./types";

/**
 * Envoi par SMTP, via nodemailer.
 *
 * Un serveur SMTP se trouve partout — chez l'hébergeur du domaine, chez un
 * routeur transactionnel, ou celui de l'entreprise elle-même. Pas de compte à
 * ouvrir chez un fournisseur d'API, et un artisan qui a déjà une adresse
 * professionnelle peut envoyer depuis la sienne.
 *
 * Le transporteur est créé une fois : il maintient un jeu de connexions
 * réutilisables. En rouvrir une par message ferait payer la poignée de main
 * TLS à chaque rapport envoyé.
 */
let transporteur: Transporter | null = null;

function getTransporteur(): Transporter {
  if (transporteur) return transporteur;

  const chiffre = env.SMTP_SECURE ?? env.SMTP_PORT === 465;
  console.info(
    `[vennora] transport SMTP ${env.SMTP_HOST}:${env.SMTP_PORT}` +
      ` · ${chiffre ? "TLS implicite" : "STARTTLS exigé"}` +
      ` · ${env.SMTP_USER ? `authentifié (${env.SMTP_USER})` : "sans authentification"}`,
  );

  transporteur = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Implicite sur 465, STARTTLS ensuite : c'est la convention, et la
    // laisser déduire du port évite une case à cocher de plus à se tromper.
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    // Hors TLS implicite, on exige STARTTLS. Sans cette ligne, un serveur qui
    // ne l'annonce pas — ou un intermédiaire qui l'escamote — ferait partir
    // le mot de passe en clair sur le réseau.
    requireTLS: !(env.SMTP_SECURE ?? env.SMTP_PORT === 465),
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined,
    pool: true,
  });

  return transporteur;
}

export async function sendViaSmtp(message: MailMessage): Promise<MailResult> {
  try {
    const info = await getTransporteur().sendMail({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    // Un serveur peut accepter le message pour une partie seulement des
    // destinataires. Le taire ferait croire à un envoi complet.
    if (info.rejected && info.rejected.length > 0) {
      throw new AppError(
        `Adresse refusée par le serveur d'envoi : ${info.rejected.join(", ")}.`,
        "MAIL_REJECTED",
        502,
      );
    }

    console.info(
      `[vennora] e-mail accepté par ${env.SMTP_HOST} — ${info.accepted?.length ?? 0} destinataire(s)` +
        ` · id ${info.messageId ?? "sans identifiant"}` +
        (info.response ? ` · réponse « ${info.response} »` : ""),
    );
    return { driver: "smtp", id: info.messageId ?? null };
  } catch (e) {
    if (e instanceof AppError) throw e;
    // Le détail — hôte, identifiants, réponse du serveur — reste dans les
    // journaux ; l'utilisateur reçoit une phrase qui dit quoi faire.
    console.error("[vennora] échec d'envoi SMTP", e);
    throw new AppError(
      "L'envoi de l'e-mail a échoué. Vérifiez la configuration SMTP ou réessayez.",
      "MAIL_FAILED",
      502,
    );
  }
}
