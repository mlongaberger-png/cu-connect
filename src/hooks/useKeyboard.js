import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";

// On-screen keyboard state, shared app-wide (one listener set, many subscribers).
//
// Why this exists: on the web, iOS Safari does not shrink a 100dvh layout when the
// keyboard opens -- the keyboard simply covers the bottom of the page. (The native app
// Build 12+ uses Keyboard resize 'native', which shrinks the WebView; older builds don't.) Anything
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
    // Builds 10-11 shipped Keyboard resize 'none' (the WebView does NOT shrink, so we must pad
    // by the keyboard height); Build 12+ uses 'native' (iOS shrinks the WebView itself, so we
    // must NOT pad or the space is counted twice). Detect which one this install has by
    // measuring whether the window actually shrank once the keyboard finished opening.
    let baseline = window.innerHeight;
    let webviewResizes = null; // unknown until the first keyboard open
    Keyboard.addListener("keyboardWillShow", (info) => {
      const kb = info?.keyboardHeight || 0;
      set({ open: true, height: webviewResizes === true ? 0 : kb });
    });
    Keyboard.addListener("keyboardDidShow", (info) => {
      const kb = info?.keyboardHeight || 0;
      webviewResizes = baseline - window.innerHeight > kb / 2;
      set({ open: true, height: webviewResizes ? 0 : kb });
    });
    Keyboard.addListener("keyboardWillHide", () => set({ open: false, height: 0 }));
    Keyboard.addListener("keyboardDidHide", () => { baseline = window.innerHeight; });
    window.addEventListener("resize", () => { if (!state.open) baseline = window.innerHeight; });
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
