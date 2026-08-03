import { createBrowserRouter } from "react-router";
import type { ReactElement } from "react";

import HistoryRoute from "../app/history";
import HomeRoute from "../app/index";
import ManualRoute from "../app/manual";
import ReferenceRoute from "../app/reference";
import ScanRoute from "../app/scan";
import SessionRoute from "../app/session";
import SettingsRoute from "../app/settings";

import { bindRouter } from "../src/navigation/router";
import { routePaths } from "./route-paths";
import type { RoutePath } from "./route-paths";
import { RootLayout } from "./root-layout";

// Keyed by path so the table and the list the build prerenders cannot drift:
// a path with no screen here will not type-check.
const screens: Record<RoutePath, ReactElement> = {
  history: <HistoryRoute />,
  manual: <ManualRoute />,
  reference: <ReferenceRoute />,
  scan: <ScanRoute />,
  session: <SessionRoute />,
  settings: <SettingsRoute />,
};

// The screens are unchanged from the Expo Router build; only the route table
// moves here. Deep links and history entries carry the deployment base path.
const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const basename = configuredBase === "" ? "/" : configuredBase;

export const appRouter = createBrowserRouter(
  [
    {
      children: [
        { element: <HomeRoute />, index: true },
        ...routePaths.map((path) => ({ element: screens[path], path })),
      ],
      element: <RootLayout />,
      path: "/",
    },
  ],
  { basename },
);

bindRouter(appRouter);
