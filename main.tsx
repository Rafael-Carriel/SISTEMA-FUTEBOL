import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import Home from '@/app/page';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/register/page';
import ForgotPasswordPage from '@/app/forgot-password/page';
import MyFutsPage from '@/app/app/page';
import FutPage from '@/app/f/[slug]/page';
import { AuthProvider } from '@/lib/auth-context';
import { ErrorBoundary } from '@/components/error-boundary';
import '@/app/globals.css';

/** Roteador client mínimo do SPA (hosting reescreve tudo para /index.html). */
function Router() {
  const path = window.location.pathname;
  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/app' || path === '/app/') return <MyFutsPage />;
  const fut = path.match(/^\/f\/([^/]+)\/?$/);
  if (fut) {
    const slug = decodeURIComponent(fut[1]);
    return <FutPage params={{ slug }} />;
  }
  return <Home />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ErrorBoundary>
        <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-background text-sm font-semibold text-muted-foreground">Carregando…</div>}>
          <Router />
        </Suspense>
      </ErrorBoundary>
    </AuthProvider>
  </StrictMode>
);
