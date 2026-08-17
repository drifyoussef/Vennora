"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ReminderStatus } from "@/core/enums";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setReminderStatusAction } from "./actions";

export interface ReminderRowData {
  id: string;
  dueDate: string;
  overdue: boolean;
  customerName: string;
  customerId: string;
  equipmentId: string | null;
  equipmentLabel: string | null;
  siteLabel: string | null;
  sourceReference: string | null;
  sourceId: string | null;
}

export function ReminderRow({ reminder }: { reminder: ReminderRowData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  function set(status: ReminderStatus, message: string) {
    startTransition(async () => {
      const result = await setReminderStatusAction(reminder.id, status);
      if (result.ok) {
        toast.success(message);
        setHidden(true);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (hidden) return null;

  // La planification prérenseigne client, site et équipement : le rappel
  // porte déjà toute l'information, autant ne pas la ressaisir.
  const planHref = reminder.equipmentId
    ? `/interventions/nouvelle?equipement=${reminder.equipmentId}`
    : `/interventions/nouvelle?client=${reminder.customerId}`;

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border bg-card p-4",
        reminder.overdue
          ? "border-severity-high/30"
          : "border-border",
      )}
    >
      <div className="w-28 shrink-0">
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            reminder.overdue && "text-severity-high",
          )}
        >
          {formatDate(reminder.dueDate)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatRelative(reminder.dueDate)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <Link
          href={`/clients/${reminder.customerId}`}
          className="font-medium hover:underline"
        >
          {reminder.customerName}
        </Link>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {reminder.equipmentLabel ?? "Équipement non précisé"}
          {reminder.siteLabel && ` · ${reminder.siteLabel}`}
        </p>
        {reminder.sourceReference && reminder.sourceId && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Issu de{" "}
            <Link
              href={`/interventions/${reminder.sourceId}`}
              className="font-mono hover:underline"
            >
              {reminder.sourceReference}
            </Link>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="gap-1.5">
          <Link href={planHref}>
            <CalendarPlus className="size-4" />
            Planifier
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => set(ReminderStatus.DONE, "Rappel marqué comme traité.")}
          className="gap-1.5"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Traité
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            set(ReminderStatus.DISMISSED, "Rappel écarté.")
          }
          className="gap-1.5 text-muted-foreground"
        >
          <X className="size-3.5" />
          Écarter
        </Button>
      </div>
    </li>
  );
}
