// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const authState = vi.hoisted(() => ({ current: { status: 'loading' as string } }));
vi.mock('./AuthContext', () => ({ useAuth: () => authState.current }));

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/perfil']}>
      <Routes>
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <div>CONTENIDO PRIVADO</div>
            </ProtectedRoute>
          }
        />
        <Route path="/cuenta" element={<div>PANTALLA CUENTA</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('mientras loading NO redirige (muestra estado de carga)', () => {
    authState.current = { status: 'loading' };
    renderAt();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('CONTENIDO PRIVADO')).toBeNull();
    expect(screen.queryByText('PANTALLA CUENTA')).toBeNull();
  });

  it('autenticado ⇒ permite el acceso', () => {
    authState.current = { status: 'authenticated' };
    renderAt();
    expect(screen.getByText('CONTENIDO PRIVADO')).toBeTruthy();
  });

  it('no autenticado ⇒ redirige a /cuenta', () => {
    authState.current = { status: 'unauthenticated' };
    renderAt();
    expect(screen.getByText('PANTALLA CUENTA')).toBeTruthy();
    expect(screen.queryByText('CONTENIDO PRIVADO')).toBeNull();
  });
});
