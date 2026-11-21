import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./game.css";
import { PlayPage } from "./PlayPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlayPage />
  </StrictMode>,
);
