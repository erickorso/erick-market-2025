import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/organisms/ErrorBoundary";
import { clearLegacyStorage } from "./services/legacyStorage";
import { installGlobalErrorHandlers } from "./services/reporter";
import { reportWebVitals } from "./services/vitals";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Install before render, so an error thrown on the first paint is still caught.
clearLegacyStorage();
installGlobalErrorHandlers();
reportWebVitals();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {/* Last resort: this one sits outside the providers, so it cannot use i18n. */}
    <ErrorBoundary source="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
