import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../theme.css";
import "./embed.css";
import { EmbedCard } from "./EmbedCard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EmbedCard />
  </StrictMode>,
);
