/* Cliente de amigos (endpoints reales del backend). */
import { apiFetch } from './client';

export const requestFriend = (username: string) =>
  apiFetch<{ status: string }>('/friends/request', { method: 'POST', body: { username } });
export const acceptFriend = (userId: string) =>
  apiFetch('/friends/accept', { method: 'POST', body: { userId } });
export const removeFriend = (userId: string) =>
  apiFetch('/friends/remove', { method: 'POST', body: { userId } });
export const incomingRequests = () =>
  apiFetch<{ requests: { userId: string; username: string }[] }>('/friends/requests');
