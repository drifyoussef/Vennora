import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/vennora/page";
import { InterventionCard } from "@/components/vennora/intervention-card";
import { getPageContext } from "@/core/context";
import { listPlanning, listTechnicians } from "@/core/data/interventions";
import { objectId } from "@/core/schemas";
import { UserRole } from "@/core/enums";
import {
  addDays,
  endOfDay,
  endOfWeek,
  formatDateLong,
  isSameDay,
  startOfDay,
  startOfWeek,
  toDateInput,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { WeekGrid } from "./week-grid";

export const metadata: Metadata = { title: "Planning" };

export default async function PlanningPage({
  searchParams,
}: PageProps<"/planning">) {
  const context = await getPageContext("intervention.view");
  const params = await searchParams;

  const view = params.vue === "semaine" ? "semaine" : "jour";
  const anchor = parseDate(params.date) ?? new Date();
  const technicianId =
    typeof params.technicien === "string" &&
    objectId.safeParse(params.technicien).success
      ? params.technicien
      : undefined;

  const from = view === "semaine" ? startOfWeek(anchor) : startOfDay(anchor);
  const to = view === "semaine" ? endOfWeek(anchor) : endOfDay(anchor);

  const [interventions, technicians] = await Promise.all([
    listPlanning(context, from, to, technicianId),
    listTechnicians(context),
  ]);

  const isAdmin = context.user.role === UserRole.ADMIN;
  const step = view === "semaine" ? 7 : 1;

  const href = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") next.set(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    return qs ? `/planning?${qs}` : "/planning";
  };

  const title =
    view === "semaine"
      ? `Semaine du ${formatDateLong(from)}`
      : capitalize(formatDateLong(anchor));

  return (
    <>
      <PageHeader
        title="Planning"
        description={title}
        actions={
          <Button asChild className="gap-1.5">
            <Link href="/interventions/nouvelle">
              <Plus className="size-4" />
              Nouvelle intervention
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link
              href={href({ date: toDateInput(addDays(anchor, -step)) })}
              aria-label={view === "semaine" ? "Semaine précédente" : "Jour précédent"}
            >
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="px-3">
            <Link href={href({ date: undefined })}>Aujourd&apos;hui</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link
              href={href({ date: toDateInput(addDays(anchor, step)) })}
              aria-label={view === "semaine" ? "Semaine suivante" : "Jour suivant"}
            >
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="flex rounded-lg border border-border bg-card p-1">
          {(["jour", "semaine"] as const).map((value) => (
            <Link
              key={value}
              href={href({ vue: value })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                view === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value}
            </Link>
          ))}
        </div>

        {isAdmin && technicians.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={href({ technicien: undefined })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                !technicianId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              Toute l&apos;équipe
            </Link>
            {technicians.map((technician) => (
              <Link
                key={technician.id}
                href={href({ technicien: technician.id })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
                  technicianId === technician.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor:
                      technician.colorHex ?? "var(--muted-foreground)",
                  }}
                />
                {technician.firstName}
              </Link>
            ))}
          </div>
        )}
      </div>

      {interventions.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune intervention"
          description={
            view === "semaine"
              ? "Rien de planifié cette semaine."
              : "Rien de planifié ce jour-là."
          }
          action={
            <Button asChild>
              <Link href="/interventions/nouvelle">Planifier une intervention</Link>
            </Button>
          }
        />
      ) : view === "semaine" ? (
        <WeekGrid from={from} interventions={interventions} showTechnician={isAdmin} />
      ) : (
        <div className="space-y-2">
          {interventions.map((intervention) => (
            <InterventionCard
              key={intervention.id}
              intervention={intervention}
              showTechnician={isAdmin}
            />
          ))}
        </div>
      )}

      {view === "jour" && interventions.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {interventions.length} intervention
          {interventions.length > 1 ? "s" : ""}
          {isSameDay(anchor, new Date()) && " aujourd'hui"}
        </p>
      )}
    </>
  );
}

/** `?date=2026-08-17`. Une date invalide retombe sur aujourd'hui. */
function parseDate(raw: string | string[] | undefined): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
