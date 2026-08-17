import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requireUser } from "@/core/auth/session";

/**
 * Coquille de l'application authentifiée.
 *
 * C'est ici que le contrôle d'accès a lieu réellement : `requireUser` relit
 * l'utilisateur en base à chaque rendu. Le middleware ne fait qu'éviter un
 * aller-retour inutile.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <Sidebar role={user.role} orgName={user.org.name} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          orgName={user.org.name}
          user={{
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            colorHex: user.colorHex,
          }}
        />

        {/* pb-24 : dégage la barre de navigation basse sur téléphone. */}
        <main className="flex-1 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <MobileNav role={user.role} />
    </div>
  );
}
