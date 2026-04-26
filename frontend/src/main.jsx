import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

// Debug: Log if root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
  document.body.innerHTML = '<div style="padding:20px;color:red">Error: Root element not found</div>';
} else {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    console.log('ZUNO App mounted successfully');
  } catch (error) {
    console.error('Failed to mount React app:', error);
    rootElement.innerHTML = `
      <div style="padding:20px;text-align:center">
        <h2 style="color:#ef4444">Failed to load ZUNO</h2>
        <p style="color:#64748b">${error.message}</p>
        <button onclick="location.reload()" style="padding:10px 20px;margin-top:10px;cursor:pointer">Reload Page</button>
      </div>
    `;
  }
}
