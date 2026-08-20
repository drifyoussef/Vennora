import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Origines autorisées en développement.
 *
 * Next bloque par défaut les ressources de développement servies à une autre
 * adresse que `localhost`, ce qui empêche d'ouvrir l'application depuis un
 * téléphone du réseau local — or c'est précisément là qu'il faut la tester.
 *
 * Les adresses IPv4 privées de la machine sont détectées au démarrage plutôt
 * qu'écrites en dur : elles changent d'un réseau à l'autre, et une valeur
 * figée dans le dépôt ne marcherait que pour celui qui l'a écrite.
 * `DEV_ALLOWED_ORIGINS` permet d'en ajouter (tunnel, nom d'hôte).
 */
function localNetworkOrigins(): string[] {
  const extra = (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const detected = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);

  return [...new Set([...detected, ...extra])];
}

const nextConfig: NextConfig = {
  // Sans effet en production : Next n'applique ce contrôle qu'en dev.
  allowedDevOrigins: localNetworkOrigins(),

  // Prisma charge son moteur par chemin dynamique : le laisser hors du bundle
  // évite que Turbopack trace tout le projet dans la sortie serveur.
  //
  // @react-pdf/renderer s'appuie sur react-reconciler, qui a besoin du React
  // « client ». Bundlé par Next, il est résolu sous la condition
  // `react-server` et échoue à l'exécution sur un `ReactSharedInternals`
  // absent. L'externaliser le fait charger par `require` depuis node_modules,
  // avec la résolution standard.
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "bcryptjs",
    "@react-pdf/renderer",
    "nodemailer",
  ],

  // Les téléversements du terrain (photos, notes vocales) transitent par des
  // Server Actions ; la limite par défaut de 1 Mo est vite atteinte par une
  // photo de téléphone, même après compression côté client.
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    // Active `forbidden()` : un technicien qui atteint une page réservée aux
    // administrateurs doit recevoir un 403 lisible, pas une page d'erreur.
    authInterrupts: true,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            // La caméra et le micro restent autorisés sur l'origine : ils
            // servent au scan de QR code et aux notes vocales.
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
