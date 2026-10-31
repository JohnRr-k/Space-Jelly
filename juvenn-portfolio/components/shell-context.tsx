"use client";

import { createContext, useContext } from "react";

export type ShellCtx = {
  introDone: boolean;
  /** Navigate with the coral page curtain. Hash targets smooth-scroll instead. */
  go: (href: string, label?: string) => void;
  scrollTo: (target: string | number, opts?: { offset?: number; immediate?: boolean }) => void;
  /** Lock / unlock page scroll (used by overlays). */
  lock: (locked: boolean) => void;
};

export const ShellContext = createContext<ShellCtx>({
  introDone: true,
  go: () => {},
  scrollTo: () => {},
  lock: () => {},
});

export const useShell = () => useContext(ShellContext);
