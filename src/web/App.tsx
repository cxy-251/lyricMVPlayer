import React from "react";
import {RouterProvider} from "react-router";

import {router} from "./router";

/**
 * Application root.
 *
 * All routing is declared in router.tsx.
 * Data loading lives in LyricDataLayout.tsx.
 * Page components: LyricPlayerPage, StudioHomePage, PaperStudioPage, EffectLabPage.
 */
export const App: React.FC = () => <RouterProvider router={router} />;
