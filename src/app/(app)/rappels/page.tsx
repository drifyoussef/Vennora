import Link from "next/link";
import type { Metadata } from "next";
import { BellRing, CalendarCheck } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { listReminders } from "@/core/data/reminders";
import { ReminderStatus } from "@/core/enums";
import { plural } from "@/core/labels";
import { formatAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReminderRow, type ReminderRowData } from "./reminder-row";

export const metadata: Metadata = { title: "Rappels" };

const TABS = [
  { value: ReminderStatus.PENDING, label: "À replanifier" },
  { value: ReminderStatus.DONE, label: "Traités" },
  { value: ReminderStatus.DISMISSED, label: "Écartés" },
] as const;

export default async function RemindersPage({
  searchParams,
}: PageProps<"/rappels">) {
  const context = await getPageContext("intervention.view");
  const params = await searchParams;

  const status =
    TABS.find((t) => t.value === params.statut)?.value ?? ReminderStatus.PENDING;

  const reminders = await listReminders(context, status);
  const overdue = reminders.filter((r) => r.overdue).length;

  const rows: ReminderRowData[] = reminders.map((r) => ({
    id: r.id,
    dueDate: r.dueDate.toISOString(),
    overdue: r.overdue,
    customerName: r.customer?.name ?? "Client inconnu",
    customerId: r.customer?.id ?? "",
    equipmentId: r.equipment?.id ?? null,
    equipmentLabel:
      r.equipment?.label ?? r.equipment?.type.label ?? null,
    siteLabel: r.equipment?.site
      ? `${r.equipment.site.name} — ${formatAddress(r.equipment.site)}`
      : null,
    sourceReference: r.sourceIntervention?.reference ?? null,
    sourceId: r.sourceIntervention?.id ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Rappels"
        description="Prochaines interventions conseillées, fixées à la clôture. Aucun client n'est relancé automatiquement."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={
              tab.value === ReminderStatus.PENDING
                ? "/rappels"
                : `/rappels?statut=${tab.value}`
            }
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              status === tab.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {overdue > 0 && status === ReminderStatus.PENDING && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-severity-high/25 bg-severity-high/8 px-3.5 py-3 text-sm text-severity-high">
          <BellRing className="size-4 shrink-0" />
          <span className="font-medium">
            {plural(overdue, "échéance dépassée", "échéances dépassées")}
          </span>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={
            status === ReminderStatus.PENDING
              ? "Aucun rappel en attente"
              : "Aucun rappel"
          }
          description={
            status === ReminderStatus.PENDING
              ? "Les prochaines interventions conseillées apparaîtront ici au fur et à mesure des clôtures."
              : "Rien dans cette catégorie."
          }
        />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} />
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            {plural(rows.length, "rappel", "rappels")}
          </p>
        </>
      )}
    </>
  );
}
