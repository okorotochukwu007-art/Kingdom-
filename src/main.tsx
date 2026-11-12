import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Filter out spurious errors injected by third-party browser extensions (e.g. MetaMask, phantom, etc.)
if (typeof window !== 'undefined') {
  const isExtensionError = (err: any): boolean => {
    if (!err) return false;
    const msg = String(err.message || err.reason?.message || err || '').toLowerCase();
    const stack = String(err.stack || err.reason?.stack || '').toLowerCase();
    const filename = String(err.filename || '').toLowerCase();

    return (
      msg.includes('metamask') ||
      msg.includes('ethereum') ||
      msg.includes('failed to connect to metamask') ||
      msg.includes('extension context invalidated') ||
      filename.includes('chrome-extension://') ||
      filename.includes('moz-extension://') ||
      filename.includes('safari-extension://') ||
      stack.includes('chrome-extension://') ||
      stack.includes('moz-extension://') ||
      stack.includes('safari-extension://')
    );
  };

  window.addEventListener(
    'error',
    (event) => {
      if (isExtensionError(event.error) || isExtensionError(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isExtensionError(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
