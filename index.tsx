import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/organisms/ErrorBoundary";
import { installGlobalErrorHandlers } from "./services/reporter";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

installGlobalErrorHandlers();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {/* Last resort: this one sits outside the providers, so it cannot use i18n. */}
    <ErrorBoundary source="root">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
