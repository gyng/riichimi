import { createBrowserRouter } from "react-router-dom";

import HistoryRoute from "../app/history";
import HomeRoute from "../app/index";
import ManualRoute from "../app/manual";
import ScanRoute from "../app/scan";
import SessionRoute from "../app/session";
import SettingsRoute from "../app/settings";

import { bindRouter } from "./expo-router";
import { RootLayout } from "./root-layout";

// The screens are unchanged from the Expo Router build; only the route table
// moves here. Deep links and history entries carry the deployment base path.
const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, "");
const basename = configuredBase === "" ? "/" : configuredBase;

export const appRouter = createBrowserRouter(
  [
    {
      children: [
        { element: <HomeRoute />, index: true },
        { element: <ManualRoute />, path: "manual" },
        { element: <ScanRoute />, path: "scan" },
        { element: <SessionRoute />, path: "session" },
        { element: <SettingsRoute />, path: "settings" },
        { element: <HistoryRoute />, path: "history" },
      ],
      element: <RootLayout />,
      path: "/",
    },
  ],
  { basename },
);

bindRouter(appRouter);
