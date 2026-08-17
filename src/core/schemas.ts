import { z } from "zod";
import {
  AnomalySeverity,
  AnomalyStatus,
  CustomerKind,
  InterventionStatus,
  UserRole,
} from "@/core/enums";
import { TEAM_COLOR_VALUES } from "@/core/palette";

/**
 * Schémas de validation.
 *
 * Partagés entre le formulaire et la Server Action, mais la validation qui
 * fait foi est celle du serveur : celle du navigateur n'est là que pour le
 * confort. Aucune action ne fait confiance à ce qui arrive du client.
 */

/** Identifiant MongoDB. Rejeter en amont évite une erreur Prisma opaque. */
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Identifiant invalide.");

const trimmed = (max: number) => z.string().trim().max(max);

/** Champ facultatif : « » venant d'un input vide devient `null`, pas `""`. */
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const optionalEmail = z
  .string()
  .trim()
  .max(180)
  .optional()
  .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Adresse e-mail invalide.",
  });

const postalCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Code postal invalide (5 chiffres).");

// --- Client -----------------------------------------------------------------

export const customerSchema = z
  .object({
    kind: z.enum(CustomerKind),
    firstName: optionalText(80),
    lastName: optionalText(80),
    companyName: optionalText(160),
    email: optionalEmail,
    phone: optionalText(30),
    phoneSecondary: optionalText(30),
    address: optionalText(200),
    postalCode: optionalText(10),
    city: optionalText(120),
    notes: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === CustomerKind.COMPANY && !v.companyName) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Renseignez la raison sociale.",
      });
    }
    if (v.kind === CustomerKind.INDIVIDUAL && !v.lastName) {
      ctx.addIssue({
        code: "custom",
        path: ["lastName"],
        message: "Renseignez le nom.",
      });
    }
    if (!v.phone && !v.email) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Renseignez au moins un téléphone ou un e-mail.",
      });
    }
  });

export type CustomerInput = z.infer<typeof customerSchema>;

/**
 * Nom d'affichage : « Dupont Jean » pour un particulier (nom d'abord, c'est
 * l'ordre attendu dans une liste triée), raison sociale pour une entreprise.
 */
export function customerDisplayName(input: {
  kind: CustomerKind;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}): string {
  if (input.kind === CustomerKind.COMPANY) {
    return input.companyName?.trim() || "Client sans nom";
  }
  return (
    [input.lastName, input.firstName].filter(Boolean).join(" ").trim() ||
    "Client sans nom"
  );
}

// --- Site -------------------------------------------------------------------

export const siteSchema = z.object({
  customerId: objectId,
  name: trimmed(120).min(1, "Renseignez le nom du site."),
  address: trimmed(200).min(1, "Renseignez l'adresse."),
  addressComplement: optionalText(200),
  postalCode: postalCode,
  city: trimmed(120).min(1, "Renseignez la ville."),
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  notes: optionalText(4000),
  accessNotes: optionalText(2000),
});

export type SiteInput = z.infer<typeof siteSchema>;

// --- Équipement -------------------------------------------------------------

export const equipmentSchema = z.object({
  siteId: objectId,
  typeId: objectId,
  label: optionalText(120),
  brand: optionalText(80),
  model: optionalText(80),
  serialNumber: optionalText(80),
  location: optionalText(80),
  installedAt: z.coerce.date().nullish(),
  description: optionalText(2000),
  notes: optionalText(4000),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;

// --- Intervention -----------------------------------------------------------

export const interventionSchema = z
  .object({
    customerId: objectId,
    siteId: objectId,
    equipmentId: objectId.nullish(),
    technicianId: objectId,
    typeId: objectId,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure de début invalide."),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure de fin invalide."),
    notes: optionalText(4000),
    internalNotes: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (v.endTime <= v.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "L'heure de fin doit suivre l'heure de début.",
      });
    }
  });

export type InterventionInput = z.infer<typeof interventionSchema>;

export const interventionStatusSchema = z.object({
  id: objectId,
  status: z.enum(InterventionStatus),
});

// --- Anomalie ---------------------------------------------------------------

export const anomalySchema = z.object({
  interventionId: objectId,
  equipmentId: objectId.nullish(),
  title: trimmed(160).min(1, "Renseignez un intitulé."),
  description: optionalText(4000),
  severity: z.enum(AnomalySeverity),
  recommendation: optionalText(2000),
  status: z.enum(AnomalyStatus).default(AnomalyStatus.OPEN),
});

export type AnomalyInput = z.infer<typeof anomalySchema>;

// --- Équipe et mots de passe ------------------------------------------------

/**
 * Politique de mot de passe.
 *
 * Longueur minimale plutôt que composition imposée : les règles du type
 * « une majuscule, un chiffre, un caractère spécial » produisent surtout des
 * « Motdepasse1! » notés sur un post-it dans la camionnette. On demande douze
 * caractères et on laisse la phrase de passe possible.
 */
export const password = z
  .string()
  .min(12, "Le mot de passe doit faire au moins 12 caractères.")
  .max(200, "Mot de passe trop long.");

const requiredEmail = z
  .string()
  .trim()
  .min(1, "Renseignez l'adresse e-mail.")
  .max(180)
  .email("Adresse e-mail invalide.")
  .transform((v) => v.toLowerCase());

const teamColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide.")
  .refine((v) => TEAM_COLOR_VALUES.includes(v), "Couleur non autorisée.");

const userBase = {
  firstName: trimmed(80).min(1, "Renseignez le prénom."),
  lastName: trimmed(80).min(1, "Renseignez le nom."),
  email: requiredEmail,
  phone: optionalText(30),
  role: z.enum(UserRole),
  colorHex: teamColor,
};

export const userCreateSchema = z
  .object({
    ...userBase,
    password,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Les deux mots de passe ne correspondent pas.",
  })
  .refine((v) => !v.password.toLowerCase().includes(v.email.split("@")[0]), {
    path: ["password"],
    message: "Le mot de passe ne doit pas contenir l'adresse e-mail.",
  });

export const userUpdateSchema = z.object({
  ...userBase,
  active: z
    .union([z.literal("on"), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

/** Changement par l'intéressé : l'ancien mot de passe fait foi. */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Renseignez votre mot de passe actuel."),
    password,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Les deux mots de passe ne correspondent pas.",
  })
  .refine((v) => v.password !== v.currentPassword, {
    path: ["password"],
    message: "Le nouveau mot de passe doit différer de l'ancien.",
  });

/** Réinitialisation par un administrateur : pas d'ancien mot de passe. */
export const passwordResetSchema = z
  .object({
    password,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Les deux mots de passe ne correspondent pas.",
  });

// --- Recherche et filtres ---------------------------------------------------

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

/**
 * Échappe une saisie utilisateur avant de la passer en `contains` Prisma.
 *
 * Prisma traduit `contains` en `$regex` sur MongoDB : un client qui tape
 * « (a+)+b » enverrait sinon une expression régulière catastrophique côté
 * base. On neutralise tous les métacaractères.
 */
export function escapeSearch(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
