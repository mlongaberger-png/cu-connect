import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

// On-screen keyboard state, shared app-wide (one listener set, many subscribers).
//
// Why this exists: the native app runs with Capacitor Keyboard `resize: 'none'`
// (capacitor.config.ts), so the WebView does NOT shrink when the keyboard opens --
// the keyboard simply covers the bottom of the page. On the web, iOS Safari does the
// same thing to a 100dvh layout (dvh ignores the keyboard). Either way, anything
// pinned to the bottom (the Messages reply box, the bottom tab bar) ends up hidden
// behind the keyboard -- exactly what was reported live 2026-09-25. Components use
// { open, height } to lift the reply box above the keyboard and hide the tab bar
// while typing.
let state = { open: false, height: 0 };
const listeners = new Set();
let started = false;

function set(next) {
  if (next.open === state.open && next.height === state.height) return;
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Keyboard")) {
    Keyboard.addListener("keyboardWillShow", (info) => set({ open: true, height: info?.keyboardHeight || 0 }));
    Keyboard.addListener("keyboardWillHide", () => set({ open: false, height: 0 }));
    return;
  }
  // Web / older native builds: infer the keyboard from the visual viewport shrinking.
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    const open = covered > 120; // ignore toolbar show/hide jitter
    set({ open, height: open ? covered : 0 });
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
}

function subscribe(cb) {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useKeyboard() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// Close the keyboard: blur whatever has focus (works everywhere) and, natively,
// ask the OS to hide it too.
export function dismissKeyboard() {
  const el = document.activeElement;
  if (el && typeof el.blur === "function") el.blur();
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Keyboard")) {
    Keyboard.hide().catch(() => {});
  }
}
