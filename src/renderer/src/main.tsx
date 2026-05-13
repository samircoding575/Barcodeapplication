import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import './styles/print.css'
import './styles/focus.css'
import { syncLocaleToDom } from './i18n/useLocale'

syncLocaleToDom()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
