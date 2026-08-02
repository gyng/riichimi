import { useLocation, useSearchParams } from "react-router";

// Navigation adapter over react-router. Screens report intent — "go to /manual
// with these params" — without knowing which router is underneath; the route
// table in `web/app-router.tsx` binds the instance in once at startup.
type Params = Readonly<Record<string, string | undefined>>;
type Href = string | { readonly pathname: string; readonly params?: Params };

interface RouterInstance {
  navigate(to: string, options?: { readonly replace?: boolean }): void | Promise<void>;
}

let instance: RouterInstance | null = null;

/** Called once by the web entry after the react-router instance is created. */
export function bindRouter(next: RouterInstance): void {
  instance = next;
}

function href(to: Href): string {
  if (typeof to === "string") {
    return to;
  }
  const pairs: [string, string][] = [];
  for (const [key, value] of Object.entries(to.params ?? {})) {
    if (value !== undefined) {
      pairs.push([key, value]);
    }
  }
  const query = new URLSearchParams(pairs).toString();
  return query === "" ? to.pathname : `${to.pathname}?${query}`;
}

/**
 * Standalone functions rather than methods: callers pass these straight to an
 * `onPress`, and a method torn off its object is a `this` waiting to go wrong.
 */
export const router = {
  back: (): void => {
    globalThis.history.back();
  },
  navigate: (to: Href): void => {
    void instance?.navigate(href(to));
  },
  push: (to: Href): void => {
    void instance?.navigate(href(to));
  },
  replace: (to: Href): void => {
    void instance?.navigate(href(to), { replace: true });
  },
};

export function useLocalSearchParams(): Params {
  const [params] = useSearchParams();
  return Object.fromEntries(params.entries());
}

export function usePathname(): string {
  return useLocation().pathname;
}
