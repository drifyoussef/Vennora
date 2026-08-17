"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, QrCode, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Scan de QR code depuis l'application.
 *
 * `BarcodeDetector` est natif sur Chrome et Android ; ailleurs — Safari iOS
 * notamment — il n'existe pas. Plutôt que d'embarquer une bibliothèque de
 * décodage de plusieurs centaines de kilo-octets pour tout le monde, on
 * détecte la capacité et on renvoie vers l'appareil photo natif, qui sait
 * ouvrir le lien et retombe sur `/e/{token}`.
 *
 * Le flux vidéo ne quitte jamais l'appareil : le décodage est local, et seule
 * l'URL reconnue déclenche une navigation.
 */
interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

function getDetectorConstructor(): BarcodeDetectorConstructor | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as Record<string, unknown>)
    .BarcodeDetector;
  return typeof candidate === "function"
    ? (candidate as BarcodeDetectorConstructor)
    : null;
}

export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const handled = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Détection de capacité via `useSyncExternalStore` : le serveur ne connaît
   * ni `BarcodeDetector` ni les permissions caméra, il répond donc `null`
   * (« on ne sait pas encore »), et le client tranche à l'hydratation. Un
   * effet produirait un rendu en cascade à chaque montage.
   */
  const supported = useSyncExternalStore<boolean | null>(
    () => () => {},
    () =>
      Boolean(getDetectorConstructor()) &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    () => null,
  );

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  // Couper la caméra en quittant l'écran : sans ça, le voyant reste allumé.
  useEffect(() => stop, [stop]);

  /**
   * Ne suit que les liens de notre propre origine. Un QR code est un vecteur
   * d'entrée non fiable : n'importe qui peut en coller un sur un appareil.
   */
  function resolve(rawValue: string) {
    if (handled.current) return;

    let path: string | null = null;
    try {
      const url = new URL(rawValue, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith("/e/")) {
        path = url.pathname;
      }
    } catch {
      path = null;
    }

    if (!path) {
      setError(
        "Ce QR code ne correspond pas à un équipement Vennora. Continuez à viser une étiquette.",
      );
      return;
    }

    handled.current = true;
    stop();
    router.push(path);
  }

  async function start() {
    setError(null);
    handled.current = false;

    const Detector = getDetectorConstructor();
    if (!Detector) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setScanning(true);

      const detector = new Detector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!streamRef.current || handled.current) return;
        try {
          if (video.readyState >= 2) {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              resolve(codes[0].rawValue);
              return;
            }
          }
        } catch {
          // Une image illisible n'est pas une erreur : on réessaie.
        }
        frameRef.current = requestAnimationFrame(() => void tick());
      };

      frameRef.current = requestAnimationFrame(() => void tick());
    } catch {
      setError(
        "Caméra inaccessible. Autorisez l'accès dans les réglages du navigateur.",
      );
      stop();
    }
  }

  if (supported === null) {
    return (
      <div className="grid h-56 place-items-center rounded-xl border border-border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand/12 text-brand">
          <QrCode className="size-6" />
        </div>
        <p className="mt-4 font-medium">Utilisez l&apos;appareil photo</p>
        <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
          Ce navigateur ne décode pas les QR codes lui-même. Visez
          l&apos;étiquette avec l&apos;appareil photo de votre téléphone : le
          lien s&apos;ouvre dans Vennora, sur la fiche de l&apos;équipement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover"
        />

        {scanning && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            <div className="size-52 rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        )}

        {!scanning && (
          <div className="absolute inset-0 grid place-items-center">
            <Button onClick={start} size="lg" className="h-12 gap-2">
              <Camera className="size-5" />
              Activer la caméra
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-severity-high/25 bg-severity-high/8 px-3 py-2.5 text-sm text-severity-high">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {scanning && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Visez l&apos;étiquette de l&apos;équipement.
          </p>
          <Button variant="outline" size="sm" onClick={stop}>
            Arrêter
          </Button>
        </div>
      )}
    </div>
  );
}
