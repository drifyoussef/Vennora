import {
  BellRing,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  MapPin,
  QrCode,
  Settings,
  TriangleAlert,
  User,
  Users,
  Wrench,
} from "lucide-react";
import type { UserRole } from "@/core/enums";
import { can, type Permission } from "./permissions";

/**
 * Navigation.
 *
 * Deux jeux distincts, parce que les deux usages n'ont rien à voir :
 * l'administrateur pilote l'entreprise depuis un bureau, le technicien
 * enchaîne des interventions depuis un téléphone, souvent d'une seule main.
 * On ne réduit pas le premier au second.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  /** Correspondance exacte : évite que « / » reste actif partout. */
  exact?: boolean;
}

/** Barre latérale, écrans larges. */
export const DESKTOP_NAV: Array<{ heading?: string; items: NavItem[] }> = [
  {
    items: [
      { href: "/", label: "Tableau de bord", icon: Home, exact: true },
      {
        href: "/interventions",
        label: "Interventions",
        icon: ClipboardList,
        permission: "intervention.view",
      },
      {
        href: "/planning",
        label: "Planning",
        icon: CalendarDays,
        permission: "intervention.view",
      },
    ],
  },
  {
    heading: "Référentiel",
    items: [
      {
        href: "/clients",
        label: "Clients",
        icon: Users,
        permission: "customer.view",
      },
      { href: "/sites", label: "Sites", icon: MapPin, permission: "site.view" },
      {
        href: "/equipements",
        label: "Équipements",
        icon: Wrench,
        permission: "equipment.view",
      },
    ],
  },
  {
    heading: "Suivi",
    items: [
      {
        href: "/rappels",
        label: "Rappels",
        icon: BellRing,
        permission: "intervention.view",
      },
      {
        href: "/anomalies",
        label: "Anomalies",
        icon: TriangleAlert,
        permission: "anomaly.view",
      },
      {
        href: "/documents",
        label: "Documents",
        icon: FileText,
        permission: "document.view",
      },
    ],
  },
  {
    items: [
      {
        href: "/parametres",
        label: "Paramètres",
        icon: Settings,
        permission: "organization.manage",
      },
    ],
  },
];

/**
 * Barre inférieure, téléphone. Cinq entrées maximum : au-delà, les cibles
 * deviennent trop étroites pour un pouce ganté.
 */
export const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "Aujourd'hui", icon: Home, exact: true },
  {
    href: "/interventions",
    label: "Interventions",
    icon: ClipboardList,
    permission: "intervention.view",
  },
  { href: "/scanner", label: "Scanner", icon: QrCode },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    permission: "customer.view",
  },
  { href: "/profil", label: "Profil", icon: User },
];

export function visibleItems(items: NavItem[], role: UserRole): NavItem[] {
  return items.filter((item) => !item.permission || can(role, item.permission));
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
