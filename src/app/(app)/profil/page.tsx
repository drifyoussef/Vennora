import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGrid, PageHeader } from "@/components/vennora/page";
import { logoutAction } from "@/components/shell/actions";
import { getPageContext } from "@/core/context";
import { USER_ROLE_LABEL } from "@/core/labels";
import { InterventionStatus, UserRole } from "@/core/enums";
import { endOfWeek, startOfWeek } from "@/lib/format";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const { db, user } = await getPageContext();

  const now = new Date();
  const [weekCount, completedCount] = await Promise.all([
    db.intervention.count({
      where: {
        technicianId: user.id,
        scheduledStart: { gte: startOfWeek(now), lte: endOfWeek(now) },
        status: { not: InterventionStatus.CANCELLED },
      },
    }),
    db.intervention.count({
      where: { technicianId: user.id, status: InterventionStatus.COMPLETED },
    }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mon profil" description={user.org.name} />

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-5 flex items-center gap-4">
          <span
            className="grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: user.colorHex ?? "var(--primary)" }}
          >
            {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold">
              {user.fullName}
            </p>
            <p className="text-sm text-muted-foreground">
              {USER_ROLE_LABEL[user.role]}
            </p>
          </div>
        </div>

        <FieldGrid className="lg:grid-cols-2">
          <Field label="E-mail">{user.email}</Field>
          <Field label="Entreprise">{user.org.name}</Field>
          <Field label="Métier">{user.org.tradeName}</Field>
          <Field label="Rôle">{USER_ROLE_LABEL[user.role]}</Field>
        </FieldGrid>
      </section>

      {user.role === UserRole.TECHNICIAN && (
        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Cette semaine</p>
            <p className="font-heading mt-1 text-3xl font-semibold tabular-nums">
              {weekCount}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Interventions terminées
            </p>
            <p className="font-heading mt-1 text-3xl font-semibold tabular-nums">
              {completedCount}
            </p>
          </div>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-base font-semibold">
          Changer mon mot de passe
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground text-pretty">
          Si vous avez oublié votre mot de passe actuel, demandez à un
          administrateur de le réinitialiser.
        </p>
        <PasswordForm />
      </section>

      <form action={logoutAction}>
        <Button
          type="submit"
          variant="outline"
          className="w-full gap-1.5 text-destructive hover:text-destructive sm:w-auto"
        >
          <LogOut className="size-4" />
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
