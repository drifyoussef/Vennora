import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/vennora/page";
import { getPageContext } from "@/core/context";
import { QrScanner } from "./qr-scanner";

export const metadata: Metadata = { title: "Scanner" };

export default async function ScannerPage() {
  await getPageContext("equipment.view");

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Scanner un équipement"
        description="Chaque équipement porte une étiquette QR qui ouvre directement son historique."
      />

      <QrScanner />

      <Button asChild variant="outline" className="mt-4 w-full gap-1.5">
        <Link href="/equipements">
          <Search className="size-4" />
          Chercher un équipement
        </Link>
      </Button>
    </div>
  );
}
