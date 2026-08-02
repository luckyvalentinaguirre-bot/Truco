import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { loadSettings, applyAnimationPreference } from './services/settings';
import './styles/global.css';

// Aplicar preferencias persistidas antes del primer render.
applyAnimationPreference(loadSettings().animations);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No se encontró el elemento #root');

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
