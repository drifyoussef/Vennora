"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/vennora/form";
import type { AnalyseImport } from "@/core/import/customers";
import type { ResultatImport } from "@/core/import/customers";
import { analyserFichierAction, importerClientsAction } from "./actions";

/**
 * Reprise d'un fichier clients, en deux temps.
 *
 * D'abord l'analyse : le fichier est lu, rien n'est écrit, et l'écran montre
 * ce qui a été compris — combien de fiches, lesquelles seront écartées, et
 * quelles colonnes n'ont pas été reconnues. C'est ce dernier point qui évite
 * la mauvaise surprise : un artisan dont la colonne « chaudière » est ignorée
 * doit l'apprendre avant l'import, pas après.
 *
 * Le fichier reste dans le champ entre les deux étapes : c'est lui qu'on
 * renvoie pour l'import, pas les lignes analysées. Ce qui revient du
 * navigateur ne se croit pas sur parole.
 */
export function ImportForm() {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [analyse, setAnalyse] = useState<AnalyseImport | null>(null);
  const [resultat, setResultat] = useState<ResultatImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function corps(): FormData | null {
    const fichier = champ.current?.files?.[0];
    if (!fichier) {
      setErreur("Choisissez un fichier CSV.");
      return null;
    }
    const data = new FormData();
    data.set("fichier", fichier);
    return data;
  }

  function analyser() {
    setErreur(null);
    setResultat(null);
    const data = corps();
    if (!data) return;

    demarrer(async () => {
      const r = await analyserFichierAction(data);
      if (!r.ok) {
        setErreur(r.error);
        setAnalyse(null);
        return;
      }
      setAnalyse(r.data);
    });
  }

  function importer() {
    setErreur(null);
    const data = corps();
    if (!data) return;

    demarrer(async () => {
      const r = await importerClientsAction(data);
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      setResultat(r.data);
      setAnalyse(null);
      toast.success(`${r.data.clientsCrees} client(s) repris.`);
      router.refresh();
    });
  }

  if (resultat) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <CheckCircle2 className="size-8 text-status-done" />
        <h2 className="font-heading mt-4 text-lg font-semibold">Reprise terminée</h2>
        <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          <li>{resultat.clientsCrees} client(s) créé(s)</li>
          <li>{resultat.sitesCrees} site(s) créé(s) à partir des adresses complètes</li>
          {resultat.ignores > 0 && <li>{resultat.ignores} déjà présent(s), ignoré(s)</li>}
          {resultat.rejetes > 0 && <li>{resultat.rejetes} ligne(s) écartée(s)</li>}
        </ul>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => router.push("/clients")} className="h-11">
            Voir les clients
          </Button>
          <Button variant="outline" className="h-11" onClick={() => setResultat(null)}>
            Reprendre un autre fichier
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-6">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed border-input px-6 py-10 text-center transition-colors hover:bg-accent/40">
          <FileSpreadsheet className="size-8 text-muted-foreground" />
          <span className="text-sm font-medium">
            Choisir un fichier CSV
          </span>
          <span className="text-xs text-muted-foreground">
            Export de tableur, séparé par des points-virgules ou des virgules.
            Colonnes reconnues : nom, prénom, téléphone, e-mail, adresse, code
            postal, ville, notes.
          </span>
          <input
            ref={champ}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={analyser}
          />
        </label>

        {erreur && (
          <div className="mt-4">
            <FormError message={erreur} />
          </div>
        )}

        {enCours && !analyse && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Lecture du fichier…
          </p>
        )}
      </div>

      {analyse && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold">
            {analyse.valides.length} fiche(s) prête(s) à être reprise(s)
          </h2>

          {analyse.doublons > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Dont {analyse.doublons} doublon(s) dans le fichier : ils seront
              créés une seule fois.
            </p>
          )}

          {analyse.colonnesIgnorees.length > 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm text-severity-medium">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Colonnes non reconnues, elles ne seront pas reprises :{" "}
                {analyse.colonnesIgnorees.join(", ")}.
              </span>
            </p>
          )}

          {analyse.valides.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Ville</th>
                    <th className="px-3 py-2 font-medium">Contact</th>
                    <th className="px-3 py-2 font-medium">Site</th>
                  </tr>
                </thead>
                <tbody>
                  {analyse.valides.slice(0, 8).map((l) => (
                    <tr key={l.numero} className="border-t border-border">
                      <td className="px-3 py-2">{l.nom}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.city ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {l.phone ?? l.email ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {l.siteCreable ? "créé" : "adresse incomplète"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analyse.valides.length > 8 && (
                <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  … et {analyse.valides.length - 8} autre(s).
                </p>
              )}
            </div>
          )}

          {analyse.rejetees.length > 0 && (
            <details className="mt-4 rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {analyse.rejetees.length} ligne(s) écartée(s)
              </summary>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {analyse.rejetees.slice(0, 20).map((r) => (
                  <li key={r.numero}>
                    Ligne {r.numero} — {r.motif}
                    {r.apercu && ` (${r.apercu})`}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              onClick={importer}
              disabled={enCours || analyse.valides.length === 0}
              className="h-11 gap-1.5"
            >
              {enCours ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Reprendre {analyse.valides.length} fiche(s)
            </Button>
            <Button
              variant="outline"
              className="h-11"
              disabled={enCours}
              onClick={() => {
                setAnalyse(null);
                if (champ.current) champ.current.value = "";
              }}
            >
              Choisir un autre fichier
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
