import "server-only";
import { ValidationError } from "@/core/errors";
import { formatSize } from "@/lib/bytes";

/**
 * Validation des fichiers téléversés.
 *
 * Le type déclaré par le navigateur et l'extension du nom de fichier sont
 * deux informations fournies par le client : un `.jpg` peut contenir un
 * script, et `Content-Type: image/png` s'écrit à la main. On lit donc les
 * premiers octets du fichier et on ne garde que ce que la signature binaire
 * confirme.
 *
 * La liste est fermée : tout ce qui n'est pas reconnu est refusé, plutôt que
 * de refuser une liste de types dangereux qu'il faudrait tenir à jour.
 */

export type FileCategory = "image" | "audio" | "document";

interface Signature {
  mime: string;
  ext: string;
  category: FileCategory;
  /** Octets attendus, `null` pour « n'importe quel octet à cette position ». */
  magic: Array<number | null>;
  offset?: number;
  /** Marque ISO-BMFF supplémentaire, lue à l'octet 8 (HEIC, MP4, M4A). */
  brands?: string[];
}

const A = (s: string) => [...s].map((c) => c.charCodeAt(0));

const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", ext: "jpg", category: "image", magic: [0xff, 0xd8, 0xff] },
  {
    mime: "image/png",
    ext: "png",
    category: "image",
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    // RIFF....WEBP : les quatre octets de taille sont ignorés.
    mime: "image/webp",
    ext: "webp",
    category: "image",
    magic: [...A("RIFF"), null, null, null, null, ...A("WEBP")],
  },
  {
    // Les iPhone photographient en HEIC par défaut.
    mime: "image/heic",
    ext: "heic",
    category: "image",
    magic: A("ftyp"),
    offset: 4,
    brands: ["heic", "heix", "heim", "heis", "hevc", "hevm", "hevs", "mif1", "msf1"],
  },
  {
    mime: "application/pdf",
    ext: "pdf",
    category: "document",
    magic: A("%PDF-"),
  },
  {
    // WebM / Matroska : conteneur des enregistrements MediaRecorder.
    mime: "audio/webm",
    ext: "webm",
    category: "audio",
    magic: [0x1a, 0x45, 0xdf, 0xa3],
  },
  {
    mime: "audio/mp4",
    ext: "m4a",
    category: "audio",
    magic: A("ftyp"),
    offset: 4,
    brands: ["M4A ", "mp42", "mp41", "isom", "iso2", "mp4a"],
  },
  { mime: "audio/ogg", ext: "ogg", category: "audio", magic: A("OggS") },
  { mime: "audio/mpeg", ext: "mp3", category: "audio", magic: A("ID3") },
  { mime: "audio/mpeg", ext: "mp3", category: "audio", magic: [0xff, 0xfb] },
  { mime: "audio/mpeg", ext: "mp3", category: "audio", magic: [0xff, 0xf3] },
  { mime: "audio/mpeg", ext: "mp3", category: "audio", magic: [0xff, 0xf2] },
];

/** Plafonds par catégorie, en octets. */
export const MAX_SIZE: Record<FileCategory, number> = {
  // Une photo de téléphone brute pèse 3 à 5 Mo ; le navigateur la compresse
  // avant envoi, mais on garde de la marge pour un envoi direct depuis la
  // pellicule.
  image: 12 * 1024 * 1024,
  // Cinq minutes de dictée en Opus tiennent dans 3 Mo. 15 Mo couvre large.
  audio: 15 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

export interface DetectedFile {
  mime: string;
  ext: string;
  category: FileCategory;
}

function matches(buffer: Buffer, signature: Signature): boolean {
  const offset = signature.offset ?? 0;
  if (buffer.length < offset + signature.magic.length) return false;

  for (let i = 0; i < signature.magic.length; i++) {
    const expected = signature.magic[i];
    if (expected !== null && buffer[offset + i] !== expected) return false;
  }

  if (signature.brands) {
    if (buffer.length < 12) return false;
    const brand = buffer.subarray(8, 12).toString("latin1");
    if (!signature.brands.includes(brand)) return false;
  }

  return true;
}

/** Réexporté pour que les appelants n'aient qu'un import à faire. */
export { formatSize };

/** Renvoie le type réel du fichier, ou `null` s'il n'est pas reconnu. */
export function detect(buffer: Buffer): DetectedFile | null {
  for (const signature of SIGNATURES) {
    if (matches(buffer, signature)) {
      return {
        mime: signature.mime,
        ext: signature.ext,
        category: signature.category,
      };
    }
  }
  return null;
}

/**
 * Valide un fichier reçu et renvoie son type réel.
 *
 * `accept` restreint aux catégories attendues par l'appel : une route qui
 * reçoit des photos n'a aucune raison d'accepter un PDF.
 */
export function validateUpload(
  buffer: Buffer,
  accept: FileCategory[],
): DetectedFile {
  if (buffer.length === 0) {
    throw new ValidationError("Le fichier est vide.");
  }

  const detected = detect(buffer);
  if (!detected) {
    throw new ValidationError(
      "Format de fichier non reconnu. Formats acceptés : JPEG, PNG, WebP, HEIC, PDF, et les enregistrements audio du navigateur.",
    );
  }

  if (!accept.includes(detected.category)) {
    throw new ValidationError(
      `Ce type de fichier n'est pas accepté ici (${detected.mime}).`,
    );
  }

  const max = MAX_SIZE[detected.category];
  if (buffer.length > max) {
    throw new ValidationError(
      `Fichier trop volumineux : ${formatSize(buffer.length)} pour un maximum de ${formatSize(max)}.`,
    );
  }

  return detected;
}

