"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Recherche liée à l'URL.
 *
 * La requête vit dans la barre d'adresse, pas dans un état local : une
 * recherche est ainsi partageable, mémorisable, et le retour arrière
 * fonctionne. Débrayée de 300 ms pour ne pas déclencher une requête par
 * frappe.
 */
export function SearchInput({
  placeholder = "Rechercher…",
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const initial = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initial);
  const [syncedWith, setSyncedWith] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resynchronise si l'URL change ailleurs (retour arrière, lien externe).
  // Ajustement pendant le rendu plutôt que dans un effet : un `setState` dans
  // un effet provoquerait un second rendu à chaque navigation.
  if (initial !== syncedWith) {
    setSyncedWith(initial);
    setValue(initial);
  }

  useEffect(() => {
    if (value === initial) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set("q", value);
      else params.delete("q");
      params.delete("page"); // toute nouvelle recherche repart en page 1

      startTransition(() => {
        router.replace(`${pathname}?${params}`, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, initial, pathname, router, searchParams]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {isPending ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
            className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )
      )}
    </div>
  );
}
