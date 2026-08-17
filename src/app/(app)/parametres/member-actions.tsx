"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setUserActiveAction } from "./actions";

export function MemberActions({
  userId,
  fullName,
  active,
  isSelf,
}: {
  userId: string;
  fullName: string;
  active: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setUserActiveAction(userId, !active);
      if (result.ok) {
        toast.success(
          result.data.active
            ? `${fullName} peut à nouveau se connecter.`
            : `${fullName} n'a plus accès à Vennora.`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label={`Actions pour ${fullName}`}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href={`/parametres/equipe/${userId}/modifier`}>
            <Pencil className="size-4" />
            Modifier
          </Link>
        </DropdownMenuItem>

        {/* Se désactiver soi-même verrouillerait l'entreprise hors de son
            propre compte : l'action est retirée plutôt que refusée. */}
        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={toggle}
              variant={active ? "destructive" : "default"}
            >
              {active ? (
                <>
                  <UserX className="size-4" />
                  Désactiver l&apos;accès
                </>
              ) : (
                <>
                  <UserCheck className="size-4" />
                  Réactiver l&apos;accès
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
