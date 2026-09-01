import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { applyGlobalAppearance, readStoredGlobalSettings } from "./globalSettings";
import { applyTheme, readStoredTheme } from "./theme";
import "./styles/index.css";

applyTheme(readStoredTheme());
applyGlobalAppearance(readStoredGlobalSettings());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
