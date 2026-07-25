import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ColorPreferencesProvider } from "./contexts/ColorPreferencesContext.jsx";
import { AuthGate } from "./components/auth/AuthGate.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <ColorPreferencesProvider>
        <App />
      </ColorPreferencesProvider>
    </AuthGate>
  </React.StrictMode>
);
