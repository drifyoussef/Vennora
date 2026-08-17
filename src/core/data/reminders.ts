import "server-only";
import { ReminderStatus, UserRole } from "@/core/enums";
import type { AppContext } from "../context";

/**
 * Rappels de prochaine intervention (§23).
 *
 * Volontairement passifs : aucun envoi automatique au client, aucune relance
 * programmée. Un rappel est une ligne dans une liste « à replanifier » que
 * quelqu'un traite quand il prépare son planning. Le cahier des charges
 * demande explicitement de ne pas construire un moteur de relances.
 */
export async function listReminders(
  { db, user }: AppContext,
  status: ReminderStatus = ReminderStatus.PENDING,
) {
  const rows = await db.reminder.findMany({
    where: {
      status,
      // Un technicien ne voit que les rappels issus de ses interventions.
      ...(user.role === UserRole.TECHNICIAN
        ? { sourceIntervention: { technicianId: user.id } }
        : {}),
    },
    orderBy: { dueDate: "asc" },
    take: 200,
    select: {
      id: true,
      dueDate: true,
      note: true,
      status: true,
      customer: { select: { id: true, name: true, phone: true, email: true } },
      equipment: {
        select: {
          id: true,
          label: true,
          location: true,
          type: { select: { label: true } },
          site: {
            select: { id: true, name: true, city: true, postalCode: true },
          },
        },
      },
      sourceIntervention: {
        select: { id: true, reference: true, scheduledStart: true },
      },
    },
  });

  const now = new Date();
  return rows.map((r) => ({ ...r, overdue: r.dueDate < now }));
}

export type ReminderItem = Awaited<ReturnType<typeof listReminders>>[number];

/** Compteurs pour la navigation et le tableau de bord. */
export async function countDueReminders({ db, user }: AppContext) {
  const scope =
    user.role === UserRole.TECHNICIAN
      ? { sourceIntervention: { technicianId: user.id } }
      : {};

  const [pending, overdue] = await Promise.all([
    db.reminder.count({ where: { ...scope, status: ReminderStatus.PENDING } }),
    db.reminder.count({
      where: {
        ...scope,
        status: ReminderStatus.PENDING,
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  return { pending, overdue };
}
