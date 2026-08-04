/* =============================================================
 * Guard de rutas que requieren autenticación.
 * -------------------------------------------------------------
 * Mientras AuthProvider verifica la sesión (loading) NO redirige:
 * muestra un estado de carga. Sólo redirige a /cuenta cuando la
 * verificación terminó y el usuario no está autenticado.
 * ============================================================= */
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div style={{ padding: 24, opacity: 0.7 }} role="status">
        Verificando sesión…
      </div>
    );
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/cuenta" replace />;
  }
  return <>{children}</>;
}
