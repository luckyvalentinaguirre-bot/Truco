// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);
import { ProfileIdentity } from './ProfileIdentity';
import { ApiError } from '@/api/client';

const authState = vi.hoisted(() => ({
  current: {
    profile: { username: 'pepe', displayName: 'Pepe', avatar: null as string | null },
    refreshUser: vi.fn(async () => {}),
  },
}));
vi.mock('./AuthContext', () => ({ useAuth: () => authState.current }));

const updateProfileMock = vi.hoisted(() => vi.fn());
vi.mock('@/api/auth', () => ({ updateProfile: updateProfileMock }));

beforeEach(() => {
  updateProfileMock.mockReset();
  authState.current.refreshUser = vi.fn(async () => {});
});

describe('ProfileIdentity', () => {
  it('muestra username y displayName', () => {
    render(<ProfileIdentity />);
    expect(screen.getByText('Pepe')).toBeTruthy();
    expect(screen.getByText('@pepe')).toBeTruthy();
  });

  it('editar displayName persiste (updateProfile) y muestra Guardado', async () => {
    updateProfileMock.mockResolvedValueOnce({ userId: '1', username: 'pepe', displayName: 'Nuevo', avatar: null });
    render(<ProfileIdentity />);
    fireEvent.change(screen.getByLabelText('displayName'), { target: { value: 'Nuevo' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith({ displayName: 'Nuevo', avatar: null }));
    await screen.findByText('Guardado ✓');
    expect(authState.current.refreshUser).toHaveBeenCalled();
  });

  it('editar avatar persiste', async () => {
    updateProfileMock.mockResolvedValueOnce({ userId: '1', username: 'pepe', displayName: 'Pepe', avatar: 'av9' });
    render(<ProfileIdentity />);
    fireEvent.change(screen.getByLabelText('avatar'), { target: { value: 'av9' } });
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({ displayName: 'Pepe', avatar: 'av9' }),
    );
  });

  it('un error de API se muestra', async () => {
    updateProfileMock.mockRejectedValueOnce(new ApiError(400, 'validation_error', 'Muy largo'));
    render(<ProfileIdentity />);
    fireEvent.click(screen.getByText('Guardar'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Muy largo');
  });
});
