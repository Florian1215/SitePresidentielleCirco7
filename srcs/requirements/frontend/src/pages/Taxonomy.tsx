import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePageTitle } from '../lib/title';

/** Élément nommé géré sur cette page : catégorie ou signature collective. */
interface Item {
  id: number;
  name: string;
  article_count?: number | null;
}

/**
 * Page « Catégories et auteurs » (administrateur·ices) : créer, renommer et supprimer
 * les catégories d'articles et les signatures collectives (Berlin Insoumise, Circo 7…).
 */
export default function Taxonomy() {
  usePageTitle('Catégories et auteurs — espace rédaction');
  const auth = useAuth();

  return (
    <section className="section-sm">
      <div className="site-container">
        <div className="mb-8">
          <span className="eyebrow">Espace rédaction</span>
          <h1 className="h2 m-0">Catégories et auteurs</h1>
        </div>

        <div className="grid grid-cols-2 items-start gap-8 max-[900px]:grid-cols-1">
          {auth.hasPerm('blog.change_collectiveauthor') && (
            <NamedList<Item>
              title="Signatures collectives"
              intro="Auteurs « généraux » proposés dans l'éditeur, pour signer les annonces communes."
              addLabel="Nouvelle signature"
              placeholder="Ex. : Berlin Insoumise"
              empty="Aucune signature collective."
              canAdd={auth.hasPerm('blog.add_collectiveauthor')}
              canDelete={auth.hasPerm('blog.delete_collectiveauthor')}
              deleteWarning={(n) =>
                n
                  ? `Elle sera retirée de ${n} article${n > 1 ? 's' : ''} (ceux qu'elle était seule à signer reviendront à leur créateur·ice).`
                  : ''
              }
              load={() => api.collectiveAuthors()}
              create={(name) => api.createCollectiveAuthor(name)}
              rename={(item, name) => api.renameCollectiveAuthor(item.id, name)}
              remove={(item) => api.deleteCollectiveAuthor(item.id)}
            />
          )}
          {auth.hasPerm('blog.change_category') && (
            <NamedList<Item & { slug: string }>
              title="Catégories"
              intro="Thèmes des articles, utilisés comme filtres sur la page Actualités."
              addLabel="Nouvelle catégorie"
              placeholder="Ex. : Europe"
              empty="Aucune catégorie."
              canAdd={auth.hasPerm('blog.add_category')}
              canDelete={auth.hasPerm('blog.delete_category')}
              deleteWarning={(n) => (n ? `${n} article${n > 1 ? 's' : ''} resteront sans catégorie.` : '')}
              load={() => api.categories()}
              create={(name) => api.createCategory(name)}
              rename={(item, name) => api.renameCategory(item.slug, name)}
              remove={(item) => api.deleteCategory(item.slug)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function NamedList<T extends Item>(props: {
  title: string;
  intro: string;
  addLabel: string;
  placeholder: string;
  empty: string;
  canAdd: boolean;
  canDelete: boolean;
  deleteWarning: (count: number) => string;
  load: () => Promise<T[]>;
  create: (name: string) => Promise<T>;
  rename: (item: T, name: string) => Promise<T>;
  remove: (item: T) => Promise<unknown>;
}) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    props.load().then(setItems, () => setLoadError(true));
  }, []);

  const sorted = (list: T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError('');
    try {
      const created = await props.create(name.trim());
      setItems((list) => sorted([...(list ?? []), created]));
      setName('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card-flat stack">
      <div>
        <h2 className="m-0 text-[24px]">{props.title}</h2>
        <p className="muted m-0 mt-1 text-[15px]">{props.intro}</p>
      </div>

      {props.canAdd && (
        <form onSubmit={add} className="flex gap-2" noValidate>
          <label className="visually-hidden" htmlFor={`add-${props.title}`}>
            {props.addLabel}
          </label>
          <input
            id={`add-${props.title}`}
            type="text"
            maxLength={80}
            placeholder={props.placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1"
          />
          <button type="submit" className="btn btn-sm shrink-0" disabled={adding || !name.trim()}>
            + Ajouter
          </button>
        </form>
      )}
      {error && (
        <div className="alert alert-err m-0" role="alert">
          {error}
        </div>
      )}

      {loadError ? (
        <div className="alert alert-err m-0">Impossible de charger la liste.</div>
      ) : items === null ? (
        <p className="loader">Chargement…</p>
      ) : !items.length ? (
        <p className="m-0 font-bold">{props.empty}</p>
      ) : (
        <ul className="m-0 list-none divide-y divide-gris p-0">
          {items.map((item) => (
            <li key={item.id}>
              <Row
                item={item}
                canDelete={props.canDelete}
                deleteWarning={props.deleteWarning}
                rename={(n) => props.rename(item, n)}
                remove={() => props.remove(item)}
                onRenamed={(u) => setItems((list) => sorted((list ?? []).map((i) => (i.id === u.id ? u : i))))}
                onRemoved={() => setItems((list) => (list ?? []).filter((i) => i.id !== item.id))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row<T extends Item>({
  item,
  canDelete,
  deleteWarning,
  rename,
  remove,
  onRenamed,
  onRemoved,
}: {
  item: T;
  canDelete: boolean;
  deleteWarning: (count: number) => string;
  rename: (name: string) => Promise<T>;
  remove: () => Promise<unknown>;
  onRenamed: (item: T) => void;
  onRemoved: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm'>('view');
  const [draft, setDraft] = useState(item.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const count = item.article_count ?? 0;

  const run = async (call: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await call();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || name === item.name) {
      setMode('view');
      return;
    }
    run(async () => {
      onRenamed(await rename(name));
      setMode('view');
    });
  };

  return (
    <div className="grid gap-2 py-3">
      {mode === 'edit' ? (
        <form onSubmit={save} className="flex flex-wrap items-center gap-2" noValidate>
          <label className="visually-hidden" htmlFor={`rename-${item.id}-${item.name}`}>
            Nouveau nom
          </label>
          <input
            id={`rename-${item.id}-${item.name}`}
            type="text"
            maxLength={80}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setMode('view')}
            className="min-w-0 flex-1"
          />
          <button type="submit" className="btn btn-sm" disabled={busy}>
            Enregistrer
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setDraft(item.name);
              setMode('view');
            }}
          >
            Annuler
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex-1 font-bold text-violet">
            {item.name}
            <span className="ml-2 text-[13px] font-normal text-texte">
              {count} article{count > 1 ? 's' : ''}
            </span>
          </span>
          {mode === 'confirm' ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-rouge">Supprimer ?</span>
              <button
                type="button"
                className="btn btn-rouge btn-sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await remove();
                    onRemoved();
                  })
                }
              >
                Oui
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setMode('view')}>
                Non
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <button
                type="button"
                className="btn-link text-[14px] font-bold"
                onClick={() => {
                  setDraft(item.name);
                  setMode('edit');
                }}
              >
                Renommer
              </button>
              {canDelete && (
                <button type="button" className="btn-link text-[14px] font-bold text-rouge" onClick={() => setMode('confirm')}>
                  Supprimer
                </button>
              )}
            </span>
          )}
        </div>
      )}
      {mode === 'confirm' && deleteWarning(count) && <p className="m-0 text-[14px] text-texte">{deleteWarning(count)}</p>}
      {error && (
        <div className="alert alert-err m-0" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
