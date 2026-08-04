// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';

const logoutMock = vi.hoisted(() => vi.fn(async () => {}));
const authState = vi.hoisted(() => ({
  current: {
    status: 'unauthenticated' as string,
    isAuthenticated: false,
    profile: null as { username: string; displayName: string | null } | null,
    logout: logoutMock,
  },
}));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => authState.current }));

function renderNav() {
  return render(
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>,
  );
}

beforeEach(() => logoutMock.mockClear());

describe('Navbar · integración de auth', () => {
  it('usuario NO autenticado ⇒ muestra "Iniciar sesión"', () => {
    authState.current = { status: 'unauthenticated', isAuthenticated: false, profile: null, logout: logoutMock };
    renderNav();
    expect(screen.getAllByText('Iniciar sesión').length).toBeGreaterThan(0);
  });

  it('usuario autenticado ⇒ muestra el username y opción de cerrar sesión', () => {
    authState.current = {
      status: 'authenticated',
      isAuthenticated: true,
      profile: { username: 'pepe', displayName: 'Pepe' },
      logout: logoutMock,
    };
    renderNav();
    expect(screen.getByText('@pepe')).toBeTruthy();
    expect(screen.getAllByText('Pepe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cerrar sesión').length).toBeGreaterThan(0);
  });

  it('click en cerrar sesión llama a logout()', async () => {
    authState.current = {
      status: 'authenticated',
      isAuthenticated: true,
      profile: { username: 'pepe', displayName: 'Pepe' },
      logout: logoutMock,
    };
    renderNav();
    fireEvent.click(screen.getAllByText('Cerrar sesión')[0]);
    await waitFor(() => expect(logoutMock).toHaveBeenCalled());
  });
});
