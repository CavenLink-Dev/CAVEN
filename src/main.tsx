import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { CavenStoreProvider } from './lib/store'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CavenStoreProvider>
      <App />
    </CavenStoreProvider>
  </React.StrictMode>,
)
