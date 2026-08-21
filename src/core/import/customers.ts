import type { AppContext } from "@/core/context";
import { CustomerKind } from "@/core/enums";
import { normaliserEntete } from "@/lib/csv";

/**
 * Reprise d'un fichier clients.
 *
 * Le fichier vient d'un tableur tenu à la main pendant dix ans : les colonnes
 * ne portent pas deux fois le même nom d'un artisan à l'autre, la moitié des
 * cases sont vides, et il y a des doublons. Refuser le fichier au premier
 * défaut, c'est refuser le client — l'import doit donc rapporter ligne par
 * ligne ce qu'il a compris, et laisser décider.
 *
 * L'analyse ne touche pas la base ; l'écriture, plus bas, reçoit le contexte
 * cloisonné en paramètre. L'action serveur n'est qu'une façade : c'est ce qui
 * rend cette reprise testable contre une vraie organisation.
 */

/**
 * Noms de colonnes acceptés, du plus courant au plus rare. Tout ce qui a été
 * vu dans un export de logiciel de gestion ou un tableur d'artisan a sa place
 * ici : c'est moins coûteux qu'un écran de correspondance manuelle.
 */
const COLONNES: Record<string, string[]> = {
  nom: ["nom", "client", "nom_client", "raison_sociale", "societe", "nom_prenom", "intitule"],
  prenom: ["prenom", "first_name"],
  type: ["type", "categorie", "nature"],
  email: ["email", "e_mail", "mail", "courriel", "adresse_mail"],
  telephone: ["telephone", "tel", "portable", "mobile", "tel_1", "numero"],
  telephone2: ["telephone2", "tel_2", "tel_secondaire", "fixe"],
  adresse: ["adresse", "adresse_1", "rue", "voie", "adresse_postale"],
  complement: ["complement", "adresse_2", "complement_adresse", "batiment"],
  codePostal: ["code_postal", "cp", "codepostal", "code_post"],
  ville: ["ville", "commune", "localite"],
  notes: ["notes", "note", "remarque", "remarques", "commentaire", "observations"],
};

/** Mots qui, dans une colonne « type », désignent une personne morale. */
const MOTS_ENTREPRISE = ["entreprise", "societe", "pro", "professionnel", "syndic", "copro", "sarl", "sas", "collectivite"];

export interface LigneClient {
  /** Numéro dans le fichier, en-tête comprise : ce que voit l'utilisateur. */
  numero: number;
  nom: string;
  kind: CustomerKind;
  email: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  address: string | null;
  addressComplement: string | null;
  postalCode: string | null;
  city: string | null;
  notes: string | null;
  /** Vrai quand l'adresse est complète : un site sera créé avec le client. */
  siteCreable: boolean;
}

export interface LigneRejetee {
  numero: number;
  motif: string;
  apercu: string;
}

export interface AnalyseImport {
  valides: LigneClient[];
  rejetees: LigneRejetee[];
  /** Colonnes du fichier qu'aucune correspondance n'a reconnues. */
  colonnesIgnorees: string[];
  /** Doublons internes au fichier, signalés mais non supprimés. */
  doublons: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function valeur(ligne: Record<string, string>, champ: string): string {
  for (const alias of COLONNES[champ] ?? []) {
    const v = ligne[alias];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

/** Clé de comparaison : « Dupont Jean » et « DUPONT  jean » sont un doublon. */
function cleDoublon(l: LigneClient): string {
  return `${normaliserEntete(l.nom)}|${l.postalCode ?? ""}`;
}

export function analyserImport(
  lignes: Array<Record<string, string>>,
  entetes: string[] = [],
): AnalyseImport {
  const valides: LigneClient[] = [];
  const rejetees: LigneRejetee[] = [];
  const vues = new Set<string>();
  let doublons = 0;

  lignes.forEach((brute, index) => {
    const numero = index + 2; // en-tête comprise, comme dans le tableur
    const apercu = Object.values(brute).filter(Boolean).slice(0, 3).join(" · ");

    const nomBrut = valeur(brute, "nom");
    const prenom = valeur(brute, "prenom");
    const nom = [nomBrut, prenom].filter(Boolean).join(" ").trim();

    if (!nom) {
      rejetees.push({ numero, motif: "Aucun nom de client.", apercu });
      return;
    }

    const email = valeur(brute, "email");
    if (email && !EMAIL.test(email)) {
      rejetees.push({ numero, motif: `Adresse e-mail invalide : ${email}`, apercu: nom });
      return;
    }

    const type = valeur(brute, "type").toLowerCase();
    const kind = MOTS_ENTREPRISE.some((m) => type.includes(m))
      ? CustomerKind.COMPANY
      : CustomerKind.INDIVIDUAL;

    const address = valeur(brute, "adresse");
    const postalCode = valeur(brute, "codePostal");
    const city = valeur(brute, "ville");

    const client: LigneClient = {
      numero,
      nom,
      kind,
      email: email || null,
      phone: valeur(brute, "telephone") || null,
      phoneSecondary: valeur(brute, "telephone2") || null,
      address: address || null,
      addressComplement: valeur(brute, "complement") || null,
      postalCode: postalCode || null,
      city: city || null,
      notes: valeur(brute, "notes") || null,
      // Un site exige une adresse, un code postal et une ville : sans les
      // trois, on crée le client seul plutôt qu'un site bancal.
      siteCreable: Boolean(address && postalCode && city),
    };

    const cle = cleDoublon(client);
    if (vues.has(cle)) doublons++;
    vues.add(cle);

    valides.push(client);
  });

  const connues = new Set(Object.values(COLONNES).flat());
  const colonnesIgnorees = entetes.filter((e) => e && !connues.has(e));

  return { valides, rejetees, colonnesIgnorees, doublons };
}

export interface ResultatImport {
  clientsCrees: number;
  sitesCrees: number;
  /** Fiches déjà présentes en base, laissées telles quelles. */
  ignores: number;
  rejetes: number;
}

/**
 * Écrit les fiches retenues.
 *
 * Idempotent sur le couple nom + code postal : un import relancé — parce que
 * la page a été rechargée, parce que le client n'était pas sûr — n'ajoute pas
 * une seconde copie du fichier. C'est la garantie qui permet de dire « vous
 * pouvez réessayer » sans arrière-pensée.
 */
export async function reprendreClients(
  { db, ctx }: AppContext,
  analyse: AnalyseImport,
): Promise<ResultatImport> {
  const existants = await db.customer.findMany({
    select: { name: true, postalCode: true },
  });
  const dejaLa = new Set(
    existants.map((c) => `${c.name.trim().toLowerCase()}|${c.postalCode ?? ""}`),
  );

  let clientsCrees = 0;
  let sitesCrees = 0;
  let ignores = 0;

  for (const ligne of analyse.valides) {
    const cle = `${ligne.nom.toLowerCase()}|${ligne.postalCode ?? ""}`;
    if (dejaLa.has(cle)) {
      ignores++;
      continue;
    }
    dejaLa.add(cle);

    const client = await db.customer.create({
      data: {
        orgId: ctx.orgId,
        name: ligne.nom,
        kind: ligne.kind,
        email: ligne.email,
        phone: ligne.phone,
        phoneSecondary: ligne.phoneSecondary,
        address: ligne.address,
        postalCode: ligne.postalCode,
        city: ligne.city,
        notes: ligne.notes,
      },
      select: { id: true },
    });
    clientsCrees++;

    if (ligne.siteCreable) {
      await db.site.create({
        data: {
          orgId: ctx.orgId,
          customerId: client.id,
          name:
            ligne.kind === CustomerKind.COMPANY
              ? "Établissement principal"
              : "Maison principale",
          address: ligne.address!,
          addressComplement: ligne.addressComplement,
          postalCode: ligne.postalCode!,
          city: ligne.city!,
        },
      });
      sitesCrees++;
    }
  }

  return { clientsCrees, sitesCrees, ignores, rejetes: analyse.rejetees.length };
}
