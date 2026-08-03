/**
 * Every route the app answers on, in one place.
 *
 * Two things read this. The router builds its table from it, so a path here
 * without a screen is a type error rather than a blank page. And the build
 * writes a copy of the SPA shell at each one, so a deep link is a real file:
 * GitHub Pages has no rewrite rule, and its `404.html` fallback rendered the
 * right page while answering 404 — invisible to a reader, but every link
 * checker and uptime monitor read the whole app as broken.
 */
export const routePaths = [
  "manual",
  "scan",
  "session",
  "settings",
  "history",
  "reference",
] as const;

export type RoutePath = (typeof routePaths)[number];
