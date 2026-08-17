"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { USER_ROLE_LABEL } from "@/core/labels";
import type { UserRole } from "@/core/enums";
import { logoutAction } from "./actions";

export function UserMenu({
  fullName,
  email,
  role,
  colorHex,
}: {
  fullName: string;
  email: string;
  role: UserRole;
  colorHex: string | null;
}) {
  const letters = fullName
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: colorHex ?? "var(--primary)" }}
        >
          {letters}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium">{fullName}</span>
          <span className="block text-xs text-muted-foreground">
            {USER_ROLE_LABEL[role]}
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{fullName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profil">
            <UserRound className="size-4" />
            Mon profil
          </Link>
        </DropdownMenuItem>
        {role === "ADMIN" && (
          <DropdownMenuItem asChild>
            <Link href="/parametres">
              <Settings className="size-4" />
              Paramètres
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild variant="destructive">
          {/* Déconnexion en POST : un GET serait déclenchable depuis un site
              tiers par une simple balise <img>. */}
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="size-4" />
              Se déconnecter
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
