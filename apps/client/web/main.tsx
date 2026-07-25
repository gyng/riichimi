import "@riichimi/ui/tokens.css";
import "./global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import bokuUrl from "../assets/fonts/YujiBoku-celebration.ttf";
import syukuUrl from "../assets/fonts/YujiSyuku-celebration.ttf";

import { appRouter } from "./app-router";

// Register the celebration brush faces against Vite's hashed asset URLs. The UI
// falls back to serif until (or unless) these resolve, so failure is non-fatal.
async function registerBrushFonts(): Promise<void> {
  try {
    const faces = [
      new FontFace("YujiBoku", `url(${bokuUrl})`),
      new FontFace("YujiSyuku", `url(${syukuUrl})`),
    ];
    const loaded = await Promise.all(faces.map((face) => face.load()));
    for (const face of loaded) {
      document.fonts.add(face);
    }
  } catch {
    // Serif fallback already covers this.
  }
}

void registerBrushFonts();

const container = document.getElementById("root");
if (container !== null) {
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={appRouter} />
    </StrictMode>,
  );
}
