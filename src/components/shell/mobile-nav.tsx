"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MOBILE_NAV, isActive, visibleItems } from "@/core/navigation";
import type { UserRole } from "@/core/enums";
import { cn } from "@/lib/utils";

/**
 * Barre inférieure, téléphone.
 *
 * Fixée en bas plutôt qu'en haut : c'est la zone atteignable au pouce sur un
 * grand écran. « Scanner » est mis en avant au centre — c'est le geste le plus
 * fréquent d'une journée de tournée.
 */
export function MobileNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = visibleItems(MOBILE_NAV, role);

  return (
    <nav
      aria-label="Navigation principale"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const isScanner = item.href === "/scanner";

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 px-1 transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:-outline-offset-2",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {isScanner ? (
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-full transition-colors",
                      active
                        ? "bg-brand text-brand-foreground"
                        : "bg-brand/12 text-brand",
                    )}
                  >
                    <item.icon className="size-5" />
                  </span>
                ) : (
                  <item.icon className="size-5" />
                )}
                <span
                  className={cn(
                    "text-[10px] leading-none font-medium",
                    isScanner && "sr-only",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
