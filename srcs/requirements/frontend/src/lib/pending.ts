import { api } from './api';
import { createStore, useStore } from './store';

/** Nombre d'articles « À valider » que le compte connecté peut valider (pastille de la barre noire). */
const pendingStore = createStore<number>(0);

export async function refreshPending() {
  try {
    const list = await api.pendingArticles();
    pendingStore.set(list.filter((a) => a.can_approve).length);
  } catch {
    /* pastille simplement non mise à jour */
  }
}

/** À appeler après une validation, une soumission ou une modification d'article. */
export const notifyPendingChanged = () => void refreshPending();

export const usePendingCount = () => useStore(pendingStore);

/** Nombre de demandes de compte en attente (pastille « Membres », administrateur·ices). */
const pendingMembersStore = createStore<number>(0);

export async function refreshPendingMembers() {
  try {
    const list = await api.members();
    pendingMembersStore.set(list.filter((m) => m.status === 'pending').length);
  } catch {
    /* pastille simplement non mise à jour */
  }
}

export const usePendingMembersCount = () => useStore(pendingMembersStore);
