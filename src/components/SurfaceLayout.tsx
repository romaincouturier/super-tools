import { useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";

export type Surface = "landing" | "learner" | "staff";

/**
 * Pose la surface sur <html> et non sur un wrapper : les popovers et dialogs
 * Radix sont rendus dans <body>, hors de tout wrapper.
 */
export function SurfaceLayout({ surface }: { surface: Surface }) {
  useLayoutEffect(() => {
    document.documentElement.dataset.surface = surface;
  }, [surface]);
  return <Outlet />;
}
