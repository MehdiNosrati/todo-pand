import { AdminApp } from "@pand/admin-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
}
