import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { AccountGate } from "./components/AccountGate"
import "./index.css"
import { CavenStoreProvider } from "./lib/store"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AccountGate>
      <CavenStoreProvider>
        <App />
      </CavenStoreProvider>
    </AccountGate>
  </React.StrictMode>,
)
