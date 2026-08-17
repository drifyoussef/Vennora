"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/core/errors";

/**
 * Confirmation de suppression.
 *
 * Quand la suppression emporte des données rattachées (les sites et
 * équipements d'un client, par exemple), on demande de retaper le nom :
 * cliquer « Supprimer » deux fois de suite est un réflexe, retaper un nom
 * ne l'est pas.
 */
export function ConfirmDelete({
  action,
  entityName,
  title,
  description,
  redirectTo,
  requireTyping = false,
  triggerLabel = "Supprimer",
  triggerVariant = "outline",
}: {
  action: () => Promise<ActionResult<{ id: string }>>;
  entityName: string;
  title: string;
  description: string;
  redirectTo: string;
  requireTyping?: boolean;
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost" | "destructive";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const confirmed = !requireTyping || typed.trim() === entityName;

  function onConfirm() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(`${entityName} supprimé.`);
        setOpen(false);
        router.push(redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-pretty">
            {description}
          </DialogDescription>
        </DialogHeader>

        {requireTyping && (
          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Saisissez <span className="font-medium">{entityName}</span> pour
              confirmer
            </Label>
            <Input
              id="confirm-name"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-11"
            />
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" type="button">
              Annuler
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!confirmed || pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Supprimer définitivement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
