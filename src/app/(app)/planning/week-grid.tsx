import Link from "next/link";

import { StatusBadge, TechnicianChip } from "@/components/vennora/badges";
import type { InterventionCard } from "@/core/data/dashboard";
import { addDays, formatTime, isSameDay, toDateInput } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

/**
 * Vue semaine.
 *
 * Sept colonnes sur écran large, une pile de journées sur téléphone. Pas de
 * grille horaire au pixel : sur une tournée de ramonage, ce qui compte est
 * l'ordre et le nombre d'interventions dans la journée, pas leur position
 * exacte sur un axe vertical. Une grille horaire donnerait l'illusion d'une
 * précision que le terrain n'a pas.
 */
export function WeekGrid({
  from,
  interventions,
  showTechnician,
}: {
  from: Date;
  interventions: InterventionCard[];
  showTechnician: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const today = new Date();

  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((day, index) => {
        const dayItems = interventions.filter((i) =>
          isSameDay(i.scheduledStart, day),
        );
        const isToday = isSameDay(day, today);

        return (
          <section
            key={day.toISOString()}
            className={cn(
              "rounded-lg border bg-card",
              isToday ? "border-primary/40" : "border-border",
              // Le week-end reste visible mais s'efface quand il est vide.
              index >= 5 && dayItems.length === 0 && "opacity-60",
            )}
          >
            <header
              className={cn(
                "flex items-baseline justify-between gap-2 rounded-t-lg px-3 py-2",
                isToday ? "bg-primary text-primary-foreground" : "bg-muted/60",
              )}
            >
              <Link
                href={`/planning?vue=jour&date=${toDateInput(day)}`}
                className="text-sm font-medium hover:underline"
              >
                <span className="lg:hidden">{DAY_LABELS[index]} </span>
                <span className="hidden lg:inline">
                  {DAY_LABELS[index].slice(0, 3)}{" "}
                </span>
                <span className="tabular-nums">{day.getDate()}</span>
              </Link>
              {dayItems.length > 0 && (
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isToday ? "opacity-80" : "text-muted-foreground",
                  )}
                >
                  {dayItems.length}
                </span>
              )}
            </header>

            {dayItems.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1.5 p-2">
                {dayItems.map((intervention) => (
                  <li key={intervention.id}>
                    <Link
                      href={`/interventions/${intervention.id}`}
                      className={cn(
                        "block rounded-md border-l-[3px] bg-muted/50 px-2.5 py-2 transition-colors hover:bg-accent",
                        intervention.status === "CANCELLED" && "opacity-55",
                      )}
                      style={{ borderLeftColor: intervention.type.colorHex }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold tabular-nums">
                          {formatTime(intervention.scheduledStart)}
                        </span>
                        <span className="truncate text-sm">
                          {intervention.customer.name}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {intervention.site.city} · {intervention.type.label}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusBadge
                          status={intervention.status}
                          className="px-1.5 py-0 text-[10px]"
                        />
                        {showTechnician && (
                          <TechnicianChip
                            firstName={intervention.technician.firstName}
                            lastName={intervention.technician.lastName}
                            colorHex={intervention.technician.colorHex}
                            className="ml-auto [&_span]:size-5 [&_span]:text-[9px]"
                          />
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
