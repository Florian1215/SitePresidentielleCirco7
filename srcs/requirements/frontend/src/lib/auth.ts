import { request } from './api';
import type { User } from './models';
import { createStore, useStore } from './store';

const TOKEN_KEY = 'lfi7.token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  user: User | null;
  /** L'utilisateur courant a été rechargé (ou il n'y a pas de jeton). */
  loaded: boolean;
}

export const authStore = createStore<AuthState>({ token: readToken(), user: null, loaded: false });

export function hasPerm(user: User | null, perm: string): boolean {
  return user?.permissions.includes(perm) ?? false;
}

function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* stockage indisponible : la session durera le temps de l'onglet */
  }
}

export function clearAuth() {
  authStore.set((s) => ({ ...s, token: null, user: null }));
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

let restoring: Promise<User | null> | undefined;

/** Recharge l'utilisateur courant à partir du jeton stocké (une seule fois au démarrage). */
export function restoreAuth(): Promise<User | null> {
  return (restoring ??= (async () => {
    if (!authStore.get().token) {
      authStore.set((s) => ({ ...s, loaded: true }));
      return null;
    }
    try {
      const user = await request<User>('/api/auth/me/');
      authStore.set((s) => ({ ...s, user, loaded: true }));
      return user;
    } catch (err) {
      // On ne déconnecte que si le jeton est refusé, pas en cas de panne réseau / 502.
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) clearAuth();
      authStore.set((s) => ({ ...s, loaded: true }));
      return null;
    }
  })());
}

export async function login(username: string, password: string) {
  const { token, user } = await request<{ token: string; user: User }>('/api/auth/login/', {
    method: 'POST',
    body: { username, password },
  });
  setToken(token);
  authStore.set((s) => ({ ...s, token, user }));
  return user;
}

export async function logout() {
  try {
    await request('/api/auth/logout/', { method: 'POST', body: {} });
  } catch {
    /* déconnexion locale quoi qu'il arrive */
  }
  clearAuth();
}

export function useAuth() {
  const state = useStore(authStore);
  return {
    ...state,
    isLoggedIn: state.user !== null,
    canWrite: hasPerm(state.user, 'blog.add_article'),
    canPublish: hasPerm(state.user, 'blog.publish_article'),
    hasPerm: (perm: string) => hasPerm(state.user, perm),
  };
}
