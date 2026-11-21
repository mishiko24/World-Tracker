import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./game.css";
import { GamePage } from "./GamePage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GamePage />
  </StrictMode>,
);
