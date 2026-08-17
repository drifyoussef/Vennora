"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VennoraLogo } from "@/components/vennora/logo";
import { DESKTOP_NAV, isActive, visibleItems } from "@/core/navigation";
import type { UserRole } from "@/core/enums";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

/**
 * Barre supérieure.
 *
 * Sur téléphone, la barre du bas couvre les cinq gestes du technicien ; le
 * menu latéral rassemble le reste, pour qu'un gérant puisse quand même tout
 * atteindre depuis son téléphone sans qu'on double l'interface.
 */
export function Topbar({
  user,
  orgName,
}: {
  user: {
    fullName: string;
    email: string;
    role: UserRole;
    colorHex: string | null;
  };
  orgName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="touch-target lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className="w-72 bg-sidebar p-0 text-sidebar-foreground"
          >
            <SheetHeader className="px-5 py-5">
              <SheetTitle className="text-left text-sidebar-primary-foreground">
                <VennoraLogo subtitle={orgName} className="text-white" />
              </SheetTitle>
            </SheetHeader>

            <nav className="space-y-6 overflow-y-auto px-3 pb-8">
              {DESKTOP_NAV.map((group, i) => {
                const items = visibleItems(group.items, user.role);
                if (items.length === 0) return null;

                return (
                  <div key={group.heading ?? i}>
                    {group.heading && (
                      <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
                        {group.heading}
                      </p>
                    )}
                    <ul className="space-y-0.5">
                      {items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                              isActive(pathname, item)
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                            )}
                          >
                            <item.icon className="size-4 shrink-0" />
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="lg:hidden" aria-label="Vennora, accueil">
          <VennoraLogo showWordmark={false} />
        </Link>

        <div className="flex-1" />

        <Button
          asChild
          size="sm"
          className="hidden gap-1.5 sm:inline-flex lg:hidden"
        >
          <Link href="/interventions/nouvelle">
            <Plus className="size-4" />
            Intervention
          </Link>
        </Button>

        <UserMenu {...user} />
      </div>
    </header>
  );
}
