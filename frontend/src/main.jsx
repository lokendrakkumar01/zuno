import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/index.css'

// Debug: Log loading start
console.log('[ZUNO] Starting app initialization...');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[ZUNO] Root element not found!');
  document.body.innerHTML = '<div style="padding:20px;color:red">Error: Root element not found</div>';
} else {
  // Remove loading screen after a short delay to ensure it's visible
  const removeLoader = () => {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.remove();
  };

  // Dynamically import App to catch any module loading errors
  import('./App.jsx')
    .then((module) => {
      const App = module.default;
      console.log('[ZUNO] App module loaded successfully');
      
      try {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
        console.log('[ZUNO] React app mounted successfully');
        setTimeout(removeLoader, 500); // Remove loader after app mounts
      } catch (renderError) {
        console.error('[ZUNO] React render error:', renderError);
        rootElement.innerHTML = `
          <div style="padding:20px;text-align:center;font-family:system-ui,sans-serif">
            <h2 style="color:#ef4444;margin-bottom:10px">⚠️ Render Error</h2>
            <p style="color:#64748b;margin-bottom:15px">${renderError.message}</p>
            <button onclick="location.reload()" style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer">Reload Page</button>
          </div>
        `;
      }
    })
    .catch((importError) => {
      console.error('[ZUNO] Failed to load App module:', importError);
      rootElement.innerHTML = `
        <div style="padding:20px;text-align:center;font-family:system-ui,sans-serif">
          <h2 style="color:#ef4444;margin-bottom:10px">⚠️ Loading Failed</h2>
          <p style="color:#64748b;margin-bottom:15px">Could not load application: ${importError.message}</p>
          <button onclick="location.reload()" style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer">Reload Page</button>
        </div>
      `;
    });
}
