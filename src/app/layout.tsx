import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vennora",
    template: "%s · Vennora",
  },
  description:
    "Gérez vos interventions. Maîtrisez vos équipements.",
  applicationName: "Vennora",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/vennora.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/vennora.svg" }],
  },
  appleWebApp: {
    capable: true,
    title: "Vennora",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // `viewportFit: cover` est indispensable pour que `env(safe-area-inset-*)`
  // renvoie autre chose que 0 sur iPhone en PWA plein écran.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0F3D4C" },
    { media: "(prefers-color-scheme: dark)", color: "#08161B" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
