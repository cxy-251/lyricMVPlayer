import React from "react";
import ReactDOM from "react-dom/client";
import "./tailwind.compiled.css";
import "./web.css";
import {App} from "./App";

console.log("🚀 main.tsx is executing! If you see this, JS is running.");

const rootElement = document.getElementById("root") as HTMLElement;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
