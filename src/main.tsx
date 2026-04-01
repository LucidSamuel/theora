import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { NotFound } from '@/pages/NotFound';

const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const App = lazy(() => import('./App'));
const Research = lazy(() => import('./pages/Research').then(m => ({ default: m.Research })));
const Audit = lazy(() => import('./pages/Audit').then(m => ({ default: m.Audit })));
const Compose = lazy(() => import('./pages/Compose').then(m => ({ default: m.Compose })));
const Changelog = lazy(() => import('./pages/Changelog').then(m => ({ default: m.Changelog })));

function Loader() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: 'var(--text-muted)',
          opacity: 0.4,
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<App />} />
          <Route path="/research" element={<Research />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
