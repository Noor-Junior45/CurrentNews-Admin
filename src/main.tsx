import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global safety guards against "Uncaught RangeError: Invalid time value"
// Guarantees that any internal or 3rd-party script calling Date or Intl methods on an invalid date won't crash
if (typeof Date !== 'undefined' && Date.prototype) {
  const originalToISOString = Date.prototype.toISOString;
  Date.prototype.toISOString = function () {
    try {
      const time = this.getTime();
      if (isNaN(time) || !isFinite(time)) {
        return originalToISOString.call(new Date());
      }
      return originalToISOString.call(this);
    } catch {
      return originalToISOString.call(new Date());
    }
  };

  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (...args: any[]) {
    try {
      const time = this.getTime();
      if (isNaN(time) || !isFinite(time)) {
        return '';
      }
      return originalToLocaleDateString.apply(this, args);
    } catch {
      return '';
    }
  };

  const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function (...args: any[]) {
    try {
      const time = this.getTime();
      if (isNaN(time) || !isFinite(time)) {
        return '';
      }
      return originalToLocaleTimeString.apply(this, args);
    } catch {
      return '';
    }
  };
}

// Safely patch Intl.DateTimeFormat accessor without breaking UnwrapDateTimeFormat
try {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat && Intl.DateTimeFormat.prototype) {
    const desc = Object.getOwnPropertyDescriptor(Intl.DateTimeFormat.prototype, 'format');
    if (desc && typeof desc.get === 'function') {
      const origGet = desc.get;
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'format', {
        configurable: true,
        enumerable: false,
        get() {
          const boundFn = origGet.call(this);
          return function (date?: Date | number) {
            if (date !== undefined) {
              const time = date instanceof Date ? date.getTime() : Number(date);
              if (isNaN(time) || !isFinite(time)) {
                return '';
              }
            }
            try {
              return boundFn(date);
            } catch {
              return '';
            }
          };
        }
      });
    }
  }
} catch {
  // Graceful fallback if Intl cannot be patched
}

import ErrorBoundary from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
