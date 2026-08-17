import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  Plus,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { InterventionCard } from "@/components/vennora/intervention-card";
import { getPageContext } from "@/core/context";
import { getDashboard } from "@/core/data/dashboard";
import { plural } from "@/core/labels";
import { formatDateLong } from "@/lib/format";
import { UserRole } from "@/core/enums";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const context = await getPageContext("dashboard.view");
  const data = await getDashboard(context);
  const { user } = context;
  const isTechnician = user.role === UserRole.TECHNICIAN;

  const today = new Date();

  return (
    <>
      <PageHeader
        title={isTechnician ? `Bonjour ${user.firstName}` : "Tableau de bord"}
        description={
          formatDateLong(today).charAt(0).toUpperCase() +
          formatDateLong(today).slice(1)
        }
        actions={
          <Button asChild className="gap-1.5">
            <Link href="/interventions/nouvelle">
              <Plus className="size-4" />
              Nouvelle intervention
            </Link>
          </Button>
        }
      />

      {/* Aujourd'hui : le seul bloc que le technicien regarde vraiment. */}
      <section
        aria-labelledby="aujourdhui"
        className="rounded-xl border border-border bg-card p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="aujourdhui" className="font-heading text-lg font-semibold">
            Aujourd&apos;hui
          </h2>
          <span className="text-sm text-muted-foreground">
            {plural(data.today.total, "intervention", "interventions", "Aucune intervention")}
          </span>
        </div>

        {data.today.total > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Tally
              value={data.today.completed}
              label="terminées"
              tone="text-status-done"
            />
            <Tally
              value={data.today.inProgress}
              label="en cours"
              tone="text-status-progress"
            />
            <Tally
              value={data.today.planned}
              label="à venir"
              tone="text-status-planned"
            />
          </div>
        )}

        <div className="mt-5 space-y-2">
          {data.today.list.length > 0 ? (
            data.today.list.map((intervention) => (
              <InterventionCard
                key={intervention.id}
                intervention={intervention}
                showTechnician={!isTechnician}
              />
            ))
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Rien de prévu aujourd'hui"
              description={
                isTechnician
                  ? "Aucune intervention ne vous est assignée pour la journée."
                  : "Aucune intervention n'est planifiée pour aujourd'hui."
              }
              action={
                <Button asChild variant="outline">
                  <Link href="/planning">Ouvrir le planning</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* Chiffres de fond, consultés une fois par jour et pas plus. */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          href="/planning"
          icon={CalendarDays}
          label="Interventions cette semaine"
          value={data.weekCount}
        />
        <Stat
          href="/clients"
          icon={Users}
          label="Clients actifs"
          value={data.customerCount}
        />
        <Stat
          href="/equipements"
          icon={Wrench}
          label="Équipements suivis"
          value={data.equipmentCount}
        />
        <Stat
          href="/anomalies"
          icon={TriangleAlert}
          label="Anomalies ouvertes"
          value={data.openAnomalies}
          hint={
            data.criticalAnomalies > 0
              ? `dont ${data.criticalAnomalies} à traiter en priorité`
              : undefined
          }
          alert={data.criticalAnomalies > 0}
        />
      </section>

      {data.upcoming.length > 0 && (
        <section aria-labelledby="a-venir" className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="a-venir" className="font-heading text-lg font-semibold">
              Prochaines interventions
            </h2>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link href="/interventions">
                Tout voir
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="space-y-2">
            {data.upcoming.map((intervention) => (
              <InterventionCard
                key={intervention.id}
                intervention={intervention}
                showTechnician={!isTechnician}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Tally({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-3 text-center">
      <div className={cn("font-heading text-2xl font-semibold tabular-nums", tone)}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Stat({
  href,
  icon: Icon,
  label,
  value,
  hint,
  alert,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-xl border border-border bg-card p-4 transition-colors",
        "hover:border-primary/25 hover:bg-accent/40",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon
          className={cn(
            "size-4 shrink-0",
            alert ? "text-severity-high" : "text-muted-foreground/60",
          )}
        />
      </div>
      <div
        className={cn(
          "font-heading mt-2 text-3xl font-semibold tabular-nums",
          alert && "text-severity-high",
        )}
      >
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Link>
  );
}
