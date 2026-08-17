"use client";

/**
 * Compression des photos avant envoi.
 *
 * Une photo de téléphone récent pèse 3 à 5 Mo pour 4000 pixels de large. Sur
 * le rapport d'un ramonage, 1600 pixels suffisent largement, et 400 Ko passent
 * en 4G depuis une cave — ce qui n'est pas le cas de 5 Mo.
 *
 * La conversion règle en prime le cas HEIC : `createImageBitmap` décode ce que
 * le navigateur sait afficher, et on ressort du JPEG lisible partout, y
 * compris dans le PDF du rapport.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;
/** En deçà, recompresser ferait perdre en qualité sans gagner en poids. */
const SKIP_BELOW_BYTES = 350 * 1024;

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file).catch(() => null);

  // Format que le navigateur ne sait pas décoder : on laisse passer le
  // fichier tel quel, le serveur le validera ou le refusera.
  if (!bitmap) {
    return {
      blob: file,
      width: 0,
      height: 0,
      originalSize: file.size,
    };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  if (scale === 1 && file.size <= SKIP_BELOW_BYTES) {
    bitmap.close();
    return { blob: file, width, height, originalSize: file.size };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { blob: file, width, height, originalSize: file.size };
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );

  // Si la recompression n'a rien gagné — cela arrive sur des images déjà
  // très optimisées — on garde l'original.
  if (!blob || blob.size >= file.size) {
    return { blob: file, width, height, originalSize: file.size };
  }

  return { blob, width, height, originalSize: file.size };
}
