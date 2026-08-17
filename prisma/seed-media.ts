import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Fabrication d'images réelles pour le jeu de démonstration.
 *
 * Le seed écrivait auparavant des clés de stockage pointant dans le vide :
 * une démonstration commerciale affichait des photos cassées et un PDF sans
 * signature. On génère donc de vrais PNG — décodables par le navigateur comme
 * par le moteur PDF.
 *
 * PNG plutôt que JPEG parce qu'il s'encode en une trentaine de lignes sans
 * dépendance : en-tête, données compressées par zlib, CRC. Un encodeur JPEG
 * demanderait une bibliothèque entière pour un usage qui ne concerne que la
 * démonstration.
 *
 * Le seed écrit directement sur le disque plutôt que de passer par le service
 * de stockage : celui-ci est marqué `server-only` et n'est pas importable
 * depuis un script Node.
 */
const STORAGE_ROOT = path.join(process.cwd(), ".storage");

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = -1;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** PNG RGB, dessiné par une fonction pixel — suffisant pour du décor. */
function encodePng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number],
): Buffer {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // type de filtre : aucun
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie (RGB)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Photo de chantier stylisée : dégradé sombre traversé d'un conduit vertical.
 * Ce n'est pas une vraie photo, mais ça en occupe la place et la forme.
 */
export function fakePhoto(seed: number): Buffer {
  const w = 480;
  const h = 360;
  const duct = 150 + ((seed * 37) % 160);

  return encodePng(w, h, (x, y) => {
    const inDuct = Math.abs(x - duct) < 46;
    const vignette = 1 - (Math.hypot(x - w / 2, y - h / 2) / (w / 1.4)) * 0.55;
    const soot = ((x * 7 + y * 13 + seed * 29) % 23) / 23;

    if (inDuct) {
      const shade = Math.round((38 + soot * 34) * vignette);
      return [shade, shade + 2, shade + 4];
    }
    const base = Math.round((96 + soot * 46) * vignette);
    return [base, Math.round(base * 0.93), Math.round(base * 0.84)];
  });
}

/** Signature manuscrite : une courbe sombre sur fond blanc. */
export function fakeSignature(seed: number): Buffer {
  const w = 360;
  const h = 120;
  const phase = (seed % 7) * 0.6;

  return encodePng(w, h, (x, y) => {
    const t = (x / w) * Math.PI * 3 + phase;
    const curve = h / 2 + Math.sin(t) * 26 + Math.sin(t * 2.7 + phase) * 11;
    const flourish = x > w * 0.78 ? Math.sin(t * 5) * 9 : 0;
    return Math.abs(y - (curve + flourish)) < 2.2
      ? [23, 40, 46]
      : [255, 255, 255];
  });
}

/** Écrit le fichier et renvoie la clé de stockage correspondante. */
export async function writeMedia(
  orgId: string,
  scope: string,
  ownerId: string,
  extension: string,
  body: Buffer,
): Promise<{ key: string; sizeBytes: number }> {
  const key = `org/${orgId}/${scope}/${ownerId}/${randomUUID()}.${extension}`;
  const full = path.join(STORAGE_ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return { key, sizeBytes: body.length };
}
