import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FutApp } from '@/components/fut-app';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FutApp />
  </StrictMode>,
);
