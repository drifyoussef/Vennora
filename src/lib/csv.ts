/**
 * Lecture de CSV.
 *
 * Écrit à la main plutôt qu'emprunté à une bibliothèque, pour une raison
 * précise : le fichier qui arrive ici n'a pas été produit par un programme,
 * mais exporté d'un tableur par un artisan. Il faut donc encaisser ce
 * qu'aucun format « standard » ne prévoit — le point-virgule des Excel
 * français, la marque d'ordre d'octets en tête, l'accentuation en
 * Windows-1252, les fins de ligne Mac, et des guillemets autour des adresses
 * qui contiennent des virgules.
 *
 * Le reste du produit ne doit jamais voir ces détails : il reçoit des lignes
 * d'objets, clés normalisées.
 */

/** Sépare les colonnes : celui qui apparaît le plus dans l'en-tête gagne. */
function detecterSeparateur(entete: string): string {
  const candidats = [";", ",", "\t", "|"];
  let meilleur = ";";
  let score = -1;
  for (const c of candidats) {
    const n = entete.split(c).length;
    if (n > score) {
      score = n;
      meilleur = c;
    }
  }
  return meilleur;
}

/**
 * Décode les octets d'un fichier téléversé.
 *
 * UTF-8 d'abord, en mode strict : s'il échoue, c'est un fichier Windows-1252,
 * ce que produisent encore Excel et bon nombre de logiciels de gestion. Sans
 * cette bascule, « Rue de l'Église » devient « Rue de l'Ã‰glise » et le client
 * conclut, à raison, que l'import ne marche pas.
 */
export function decoderTexte(octets: Uint8Array): string {
  let texte: string;
  try {
    texte = new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    texte = new TextDecoder("windows-1252").decode(octets);
  }
  // Marque d'ordre d'octets : invisible, mais elle colle au nom de la
  // première colonne et fait échouer toute correspondance d'en-tête.
  return texte.replace(/^﻿/, "");
}

/** Découpe une ligne en respectant les guillemets et les doublements. */
function decouper(ligne: string, separateur: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let entreGuillemets = false;

  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (ligne[i + 1] === '"') {
          courant += '"';
          i++;
        } else entreGuillemets = false;
      } else courant += c;
    } else if (c === '"') {
      entreGuillemets = true;
    } else if (c === separateur) {
      champs.push(courant);
      courant = "";
    } else courant += c;
  }
  champs.push(courant);
  return champs.map((v) => v.trim());
}

/**
 * Normalise un nom de colonne : « Code Postal », « code_postal » et
 * « CODE POSTAL » désignent la même chose pour qui a rempli le tableur.
 */
export function normaliserEntete(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export interface CsvLu {
  entetes: string[];
  /** Une entrée par ligne de données, clés normalisées. */
  lignes: Array<Record<string, string>>;
}

export function lireCsv(contenu: string): CsvLu {
  // Les guillemets peuvent contenir des sauts de ligne : on découpe le
  // fichier en lignes logiques avant de découper en champs.
  const brut = contenu.replace(/\r\n?/g, "\n");
  const lignesBrutes: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (const c of brut) {
    if (c === '"') entreGuillemets = !entreGuillemets;
    if (c === "\n" && !entreGuillemets) {
      lignesBrutes.push(courant);
      courant = "";
    } else courant += c;
  }
  if (courant.trim()) lignesBrutes.push(courant);

  const utiles = lignesBrutes.filter((l) => l.trim().length > 0);
  if (utiles.length === 0) return { entetes: [], lignes: [] };

  const separateur = detecterSeparateur(utiles[0]);
  const entetes = decouper(utiles[0], separateur).map(normaliserEntete);

  const lignes = utiles.slice(1).map((ligne) => {
    const champs = decouper(ligne, separateur);
    const objet: Record<string, string> = {};
    entetes.forEach((cle, i) => {
      if (cle) objet[cle] = champs[i] ?? "";
    });
    return objet;
  });

  return { entetes, lignes };
}

/**
 * Écriture de CSV, pour l'export.
 *
 * Point-virgule et BOM en tête, contrairement à la lecture qui accepte tout :
 * le fichier produit ici sera ouvert dans Excel, en France. Sans la marque
 * d'ordre d'octets, les accents y arrivent en charabia ; sans le
 * point-virgule, tout se retrouve dans la première colonne.
 */
export function ecrireCsv(
  entetes: string[],
  lignes: Array<Array<string | number | null | undefined>>,
): string {
  const echapper = (v: string | number | null | undefined): string => {
    const texte = v === null || v === undefined ? "" : String(v);
    // Un champ qui contient le séparateur, un guillemet ou un saut de ligne
    // doit être encadré, et ses guillemets doublés.
    return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
  };

  const corps = [entetes, ...lignes]
    .map((ligne) => ligne.map(echapper).join(";"))
    .join("\r\n");

  return `\ufeff${corps}\r\n`;
}
