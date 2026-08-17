import "server-only";
import QRCode from "qrcode";
import { env } from "@/lib/env";

/**
 * QR codes d'équipement.
 *
 * L'URL encodée porte un jeton opaque, jamais l'identifiant de l'équipement :
 * l'étiquette est collée sur un appareil, visible de quiconque entre dans la
 * pièce, et un identifiant de base de données lisible sur une étiquette est
 * une invitation à l'énumération. Le jeton est régénérable sans toucher aux
 * données (voir `regenerateQrTokenAction`).
 *
 * Scanner l'étiquette n'ouvre rien à un inconnu : `/e/{token}` est derrière
 * l'authentification et la résolution se fait dans le tenant de l'utilisateur
 * connecté. Un technicien d'une autre entreprise qui scanne l'étiquette
 * obtient « introuvable ».
 */

export function equipmentQrUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? env.AUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/e/${token}`;
}

/**
 * SVG du QR code, prêt à être inséré dans la page ou dans un PDF.
 *
 * Correction d'erreur au niveau M (~15 %) : l'étiquette vit dans une
 * chaufferie, elle sera poussiéreuse et éraflée avant sa deuxième année.
 */
export async function renderEquipmentQrSvg(
  token: string,
  options: { size?: number; margin?: number } = {},
): Promise<string> {
  return QRCode.toString(equipmentQrUrl(token), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: options.margin ?? 1,
    width: options.size ?? 240,
    color: { dark: "#0F3D4C", light: "#FFFFFF" },
  });
}

/** Version PNG en data URI, pour l'impression et l'e-mail. */
export async function renderEquipmentQrDataUrl(
  token: string,
  size = 512,
): Promise<string> {
  return QRCode.toDataURL(equipmentQrUrl(token), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#0F3D4C", light: "#FFFFFF" },
  });
}
