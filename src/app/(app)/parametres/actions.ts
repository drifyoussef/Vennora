"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashPassword } from "@/core/auth/password";
import { getActionContext } from "@/core/context";
import { UserRole } from "@/core/enums";
import { NotFoundError, toActionError, type ActionResult } from "@/core/errors";
import {
  objectId,
  passwordResetSchema,
  userCreateSchema,
  userUpdateSchema,
} from "@/core/schemas";
import { audit } from "@/core/tenant";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

/** L'index unique sur `User.email` est global : la collision remonte en P2002. */
function isEmailTaken(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

const EMAIL_TAKEN = {
  ok: false as const,
  code: "CONFLICT",
  error: "Cette adresse e-mail est déjà utilisée.",
  fieldErrors: { email: ["Cette adresse e-mail est déjà utilisée."] },
};

/**
 * Nombre d'administrateurs actifs, hors celui qu'on est en train de modifier.
 *
 * Sert à empêcher les deux manœuvres qui verrouillent une entreprise hors de
 * son propre compte : rétrograder le dernier administrateur, ou le désactiver.
 */
async function otherActiveAdmins(
  db: Awaited<ReturnType<typeof getActionContext>>["db"],
  exceptId: string,
): Promise<number> {
  return db.user.count({
    where: { role: UserRole.ADMIN, active: true, id: { not: exceptId } },
  });
}

export async function createUserAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("user.manage");

    const parsed = userCreateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;

    try {
      const user = await db.user.create({
        data: {
          orgId: ctx.orgId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          role: input.role,
          colorHex: input.colorHex,
          passwordHash: await hashPassword(input.password),
          active: true,
        },
        select: { id: true, email: true, role: true },
      });

      await audit(ctx, {
        action: "user.created",
        entity: "User",
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      });

      revalidatePath("/parametres");
      return { ok: true, data: { id: user.id } };
    } catch (e) {
      if (isEmailTaken(e)) return EMAIL_TAKEN;
      throw e;
    }
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateUserAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx, user: actor } = await getActionContext("user.manage");
    const userId = objectId.parse(id);

    const parsed = userUpdateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const input = parsed.data;

    const target = await db.user.findFirst({
      where: { id: userId },
      select: { id: true, role: true, active: true, email: true },
    });
    if (!target) throw new NotFoundError("Utilisateur");

    const losesAdmin =
      target.role === UserRole.ADMIN &&
      (input.role !== UserRole.ADMIN || !input.active);

    if (losesAdmin && (await otherActiveAdmins(db, userId)) === 0) {
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "C'est le dernier administrateur actif. Nommez-en un autre avant de modifier celui-ci.",
      };
    }

    if (userId === actor.id && !input.active) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "Vous ne pouvez pas désactiver votre propre compte.",
      };
    }

    try {
      await db.user.updateMany({
        where: { id: userId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          role: input.role,
          colorHex: input.colorHex,
          active: input.active,
        },
      });
    } catch (e) {
      if (isEmailTaken(e)) return EMAIL_TAKEN;
      throw e;
    }

    await audit(ctx, {
      action: "user.updated",
      entity: "User",
      entityId: userId,
      metadata: {
        role: input.role,
        active: input.active,
        roleChanged: target.role !== input.role,
      },
    });

    revalidatePath("/parametres");
    return { ok: true, data: { id: userId } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Activation ou désactivation rapide depuis la liste.
 *
 * On ne supprime jamais un utilisateur : ses interventions, ses rapports et
 * ses signatures le référencent, et un rapport signé par un compte disparu
 * perd sa valeur probante.
 */
export async function setUserActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult<{ id: string; active: boolean }>> {
  try {
    const { db, ctx, user: actor } = await getActionContext("user.manage");
    const userId = objectId.parse(id);

    if (userId === actor.id && !active) {
      return {
        ok: false,
        code: "CONFLICT",
        error: "Vous ne pouvez pas désactiver votre propre compte.",
      };
    }

    const target = await db.user.findFirst({
      where: { id: userId },
      select: { id: true, role: true, firstName: true, lastName: true },
    });
    if (!target) throw new NotFoundError("Utilisateur");

    if (
      !active &&
      target.role === UserRole.ADMIN &&
      (await otherActiveAdmins(db, userId)) === 0
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "C'est le dernier administrateur actif. Nommez-en un autre avant de le désactiver.",
      };
    }

    await db.user.updateMany({ where: { id: userId }, data: { active } });

    await audit(ctx, {
      action: active ? "user.reactivated" : "user.deactivated",
      entity: "User",
      entityId: userId,
      metadata: { name: `${target.firstName} ${target.lastName}` },
    });

    revalidatePath("/parametres");
    return { ok: true, data: { id: userId, active } };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Réinitialisation par un administrateur.
 *
 * `passwordChangedAt` est mis à jour : tous les jetons déjà émis pour ce
 * compte cessent d'être acceptés, y compris ceux d'un appareil perdu — c'est
 * précisément l'usage attendu de cette action.
 */
export async function resetUserPasswordAction(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { db, ctx } = await getActionContext("user.manage");
    const userId = objectId.parse(id);

    const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return {
        ok: false,
        error: "Vérifiez les champs en rouge.",
        code: "VALIDATION",
        fieldErrors: fieldErrors(parsed.error),
      };
    }

    const target = await db.user.findFirst({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!target) throw new NotFoundError("Utilisateur");

    await db.user.updateMany({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(parsed.data.password),
        passwordChangedAt: new Date(),
      },
    });

    await audit(ctx, {
      action: "user.passwordReset",
      entity: "User",
      entityId: userId,
      metadata: { email: target.email },
    });

    revalidatePath("/parametres");
    return { ok: true, data: { id: userId } };
  } catch (e) {
    return toActionError(e);
  }
}
