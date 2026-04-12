import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { startKeepAlive } from './utils/keepAlive.js'

// Start keep-alive pings to prevent Render free-tier backend from sleeping
startKeepAlive();

ReactDOM.createRoot(document.getElementById('root')).render(
      <App />,
)
