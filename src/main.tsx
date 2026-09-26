import React from "react";
import ReactDOM from "react-dom/client";
import { UpdateNotice } from "./components/UpdateNotice";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <UpdateNotice />
  </React.StrictMode>,
);
