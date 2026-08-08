/* =============================================================
 * Integración · Amigos (solicitud, aceptación, auto-aceptación, lista).
 * ============================================================= */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { hasDatabase, prepareSchema, truncateAll } from './testDb.js';
import { closePool } from '../db/pool.js';
import { createAccount } from '../services/account.service.js';
import {
  requestFriendByUsername,
  acceptFriend,
  getFriends,
  getIncomingRequests,
  removeFriend,
} from '../services/friends.service.js';

const d = hasDatabase ? describe : describe.skip;

d('amigos', () => {
  beforeAll(async () => {
    await prepareSchema();
  });
  afterAll(async () => {
    await closePool();
  });
  beforeEach(async () => {
    await truncateAll();
  });

  async function user(n: number, name: string) {
    const a = await createAccount({ email: `f${n}@mail.com`, password: 'clavefuerte9', username: name });
    return a.id;
  }

  it('solicitud → aparece como pendiente → aceptar → amigos', async () => {
    const a = await user(1, 'Alice');
    const b = await user(2, 'Bob');

    const out = await requestFriendByUsername(a, 'Bob');
    expect(out.status).toBe('requested');

    const incoming = await getIncomingRequests(b);
    expect(incoming.map((r) => r.username)).toContain('Alice');

    const ok = await acceptFriend(b, a);
    expect(ok).toBe(true);

    const friendsA = await getFriends(a);
    const friendsB = await getFriends(b);
    expect(friendsA.map((f) => f.username)).toContain('Bob');
    expect(friendsB.map((f) => f.username)).toContain('Alice');
  });

  it('si B ya te pidió, tu solicitud se AUTO-acepta', async () => {
    const a = await user(1, 'Alice');
    const b = await user(2, 'Bob');
    await requestFriendByUsername(b, 'Alice'); // B → A
    const out = await requestFriendByUsername(a, 'Bob'); // A → B: auto-acepta
    expect(out.status).toBe('accepted');
    expect((await getFriends(a)).length).toBe(1);
  });

  it('no podés agregarte a vos mismo ni a un usuario inexistente', async () => {
    const a = await user(1, 'Alice');
    await expect(requestFriendByUsername(a, 'Alice')).rejects.toThrow();
    await expect(requestFriendByUsername(a, 'Fantasma')).rejects.toThrow();
  });

  it('eliminar amistad la quita para ambos', async () => {
    const a = await user(1, 'Alice');
    const b = await user(2, 'Bob');
    await requestFriendByUsername(a, 'Bob');
    await acceptFriend(b, a);
    await removeFriend(a, b);
    expect((await getFriends(a)).length).toBe(0);
    expect((await getFriends(b)).length).toBe(0);
  });
});
