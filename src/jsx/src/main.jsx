import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import DiagramPlayer from "./DiagramPlayer.jsx";
// The page lives next to the diagram's spec.json (copied there by the build).
createRoot(document.getElementById("root")).render(<DiagramPlayer specUrl="./spec.json" />);
