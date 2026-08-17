import { useCallback, useEffect, useState } from "react";

export type InstallPlatform = "ios" | "android" | "desktop" | "other";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Shared holder for the browser's deferred install prompt.
 *
 * `beforeinstallprompt` fires once, early, and only one listener can keep the
 * event. Capturing it in a module-level store lets every surface (the one-time
 * hint, the Settings card, the More sheet) offer a working install button.
 */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function ensureGlobalListeners() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __ledgerlyInstallWired?: boolean };
  if (w.__ledgerlyInstallWired) return;
  w.__ledgerlyInstallWired = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

export function detectPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  // iPadOS 13+ reports as Mac but has touch support.
  if (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1) return "ios";
  if (/Android/.test(ua)) return "android";
  if (window.innerWidth >= 768) return "desktop";
  return "other";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export type InstallPromptState = {
  /** True when the browser handed us a native install prompt we can fire. */
  canPrompt: boolean;
  /** True once the app is running as an installed app. */
  isStandalone: boolean;
  platform: InstallPlatform;
  /** Fires the native prompt. Returns true when the user accepted. */
  promptInstall: () => Promise<boolean>;
};

export function useInstallPrompt(): InstallPromptState {
  const [, force] = useState(0);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    ensureGlobalListeners();
    setPlatform(detectPlatform());
    setStandalone(isStandaloneDisplay());
    const onChange = () => force((n) => n + 1);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    const evt = deferredPrompt;
    await evt.prompt();
    const choice = await evt.userChoice;
    deferredPrompt = null;
    if (choice?.outcome === "accepted") installed = true;
    emit();
    return choice?.outcome === "accepted";
  }, []);

  return {
    canPrompt: deferredPrompt !== null,
    isStandalone: standalone || installed,
    platform,
    promptInstall,
  };
}
