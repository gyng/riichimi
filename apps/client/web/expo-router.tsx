import { Outlet, useLocation, useSearchParams } from "react-router-dom";

// Compat shim that lets the app's screens keep importing `expo-router` while the
// web build runs on react-router. It maps the tiny surface the app uses:
// imperative `router` navigation, search-param access, the current pathname, and
// the `Stack`/`Slot` outlets. Aliased in vite.config.ts.
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

export const router = {
  back(): void {
    globalThis.history.back();
  },
  navigate(to: Href): void {
    void instance?.navigate(href(to));
  },
  push(to: Href): void {
    void instance?.navigate(href(to));
  },
  replace(to: Href): void {
    void instance?.navigate(href(to), { replace: true });
  },
  setParams(_params: Params): void {
    // No route in the app relies on in-place param replacement.
  },
};

export function useLocalSearchParams<T extends Params = Params>(): T {
  const [params] = useSearchParams();
  return Object.fromEntries(params.entries()) as T;
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function Stack(_props: unknown) {
  return <Outlet />;
}
Stack.Screen = function StackScreen(_props: unknown): null {
  return null;
};

export function Slot() {
  return <Outlet />;
}
