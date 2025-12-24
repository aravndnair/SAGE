import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AppProvider } from "./state/appState.jsx";

console.log("main.jsx loading...");
console.log("React:", React);
console.log("ReactDOM:", ReactDOM);

const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);

if (!rootElement) {
  console.error("Root element not found!");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    console.log("React root created");
    
    root.render(
      <React.StrictMode>
        <AppProvider>
          <App />
        </AppProvider>
      </React.StrictMode>
    );
    
    console.log("App rendered");
  } catch (error) {
    console.error("Render error:", error);
  }
}
