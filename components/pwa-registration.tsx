'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !window.isSecureContext ||
      !('serviceWorker' in navigator)
    )
      return;

    const register = () => {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch((error: unknown) => {
          console.warn('ORBIT offline support could not be registered.', error);
        });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
