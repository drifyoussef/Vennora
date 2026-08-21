"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OffreBadge } from "@/components/vennora/badges";
import { VennoraLogo } from "@/components/vennora/logo";
import type { Plan } from "@/core/enums";
import { DESKTOP_NAV, isActive, visibleItems } from "@/core/navigation";
import type { UserRole } from "@/core/enums";
import { cn } from "@/lib/utils";

/**
 * Barre latérale, écrans larges.
 *
 * Fond bleu pétrole plein : c'est la seule grande surface colorée de
 * l'application. Elle sert de repère permanent et laisse le contenu, lui,
 * sur fond sable très clair.
 */
export function Sidebar({
  role,
  orgName,
  plan,
}: {
  role: UserRole;
  orgName: string;
  plan: Plan;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="px-5 py-5">
        <Link
          href="/"
          className="block rounded-md text-sidebar-primary-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          <VennoraLogo
            subtitle={orgName}
            badge={<OffreBadge plan={plan} />}
            className="text-white"
          />
        </Link>
      </div>

      <div className="px-3 pb-4">
        <Button
          asChild
          className="h-10 w-full justify-start gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
        >
          <Link href="/interventions/nouvelle">
            <Plus className="size-4" />
            Nouvelle intervention
          </Link>
        </Button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {DESKTOP_NAV.map((group, i) => {
          const items = visibleItems(group.items, role);
          if (items.length === 0) return null;

          return (
            <div key={group.heading ?? i}>
              {group.heading && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
                  {group.heading}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
