/* =============================================================
 * Backend · Servicio de amigos (reglas de dominio)
 * -------------------------------------------------------------
 * Resuelve por username, valida (no uno mismo, no repetir) y auto-acepta si el
 * otro ya te había enviado la solicitud. El userId propio SIEMPRE sale de la
 * sesión, nunca del cliente.
 * ============================================================= */
import { badRequest } from '../http/httpError.js';
import { findProfileByUsername } from '../repositories/profiles.repository.js';
import {
  createRequest,
  acceptRequest,
  hasPendingRequest,
  areFriends,
  listFriends,
  listIncomingRequests,
  removeFriendship,
} from '../repositories/friends.repository.js';

export type RequestOutcome = { status: 'requested' } | { status: 'accepted' } | { status: 'already_friends' };

/** Envía (o auto-acepta) una solicitud de amistad por username. */
export async function requestFriendByUsername(
  userId: string,
  username: string,
): Promise<RequestOutcome> {
  const profile = await findProfileByUsername(username);
  if (!profile) throw badRequest('No existe un usuario con ese nombre');
  const otherId = profile.userId;
  if (otherId === userId) throw badRequest('No podés agregarte a vos mismo');

  if (await areFriends(userId, otherId)) return { status: 'already_friends' };

  // Si el otro ya te había pedido amistad, se acepta directamente.
  if (await hasPendingRequest(otherId, userId)) {
    await acceptRequest(userId, otherId);
    return { status: 'accepted' };
  }

  await createRequest(userId, otherId);
  return { status: 'requested' };
}

/** Acepta una solicitud recibida. */
export async function acceptFriend(userId: string, otherId: string): Promise<boolean> {
  return acceptRequest(userId, otherId);
}

/** Elimina la amistad o rechaza una solicitud. */
export async function removeFriend(userId: string, otherId: string): Promise<void> {
  await removeFriendship(userId, otherId);
}

export async function getFriends(userId: string) {
  return listFriends(userId);
}

export async function getIncomingRequests(userId: string) {
  return listIncomingRequests(userId);
}
