import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { RichEditor } from '../components/RichEditor';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { maxLength, required, useForm } from '../lib/forms';
import type { Category } from '../lib/models';
import { usePageTitle } from '../lib/title';
import './ArticleEditor.scss';

export default function ArticleEditor() {
  /** Présent uniquement en modification (route blog/:slug/modifier). */
  const { slug } = useParams();
  usePageTitle(slug ? "Modifier l'article" : 'Écrire un article');
  const auth = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [currentCover, setCurrentCover] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [wasPublished, setWasPublished] = useState(false);
  const coverFile = useRef<File | null>(null);
  const removeCover = useRef(false);

  const form = useForm(
    { title: '', excerpt: '', content: '', category: null as number | null, status: 'draft' },
    { title: [required, maxLength(200)], excerpt: [maxLength(400)], content: [required] },
  );
  const canPublish = auth.canPublish || wasPublished;

  useEffect(() => {
    api.categories().then(setCategories, () => {});
    if (!slug) return;
    api.article(slug).then(
      (a) => {
        if (!a.can_edit) {
          setLoadError("Vous n'avez pas le droit de modifier cet article.");
          return;
        }
        form.setValues({ title: a.title, excerpt: a.excerpt, content: a.content ?? '', category: a.category, status: a.status });
        setWasPublished(a.status === 'published');
        setCurrentCover(a.cover_image);
      },
      () => setLoadError('Article introuvable.'),
    );
  }, [slug]);

  const onCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    coverFile.current = file;
    removeCover.current = false;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  };

  const clearCover = () => {
    coverFile.current = null;
    removeCover.current = true;
    setCurrentCover(null);
    setCoverPreview(null);
  };

  const save = async (status?: 'draft' | 'published') => {
    const v = status ? { ...form.values, status } : form.values;
    if (status) form.set('status', status);
    setError('');
    if (form.invalid) {
      form.touchAll();
      setError('Le titre et le contenu sont obligatoires.');
      return;
    }
    setSaving(true);
    try {
      const a = await api.saveArticle(
        { ...v, category: v.category ? Number(v.category) : null, cover: coverFile.current, removeCover: removeCover.current },
        slug,
      );
      setSaving(false);
      navigate(`/blog/${a.slug}`);
    } catch (err) {
      setSaving(false);
      setError(apiErrorMessage(err));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save();
  };

  const coverSrc = coverPreview || currentCover;

  return (
    <section className="section-sm page-editor">
      <div className="container">
        <Link to="/blog" className="back">
          ← Retour aux actualités
        </Link>
        <h1 className="h2">{slug ? "Modifier l'article" : 'Écrire un article'}</h1>

        {loadError ? (
          <div className="alert alert-err">{loadError}</div>
        ) : (
          <>
            {!auth.canPublish && (
              <div className="alert alert-info info">
                Vous pouvez rédiger et enregistrer vos articles en brouillon. Un·e éditeur·ice les relira et les publiera.
              </div>
            )}

            <form onSubmit={onSubmit} className="editor" noValidate>
              <div className="main stack">
                <div className="field">
                  <label htmlFor="ed-title">Titre *</label>
                  <input id="ed-title" type="text" className="title-input" {...form.text('title')} />
                </div>
                <div className="field">
                  <label htmlFor="ed-excerpt">
                    Chapô <span className="hint">(résumé affiché dans la liste, 400 caractères max.)</span>
                  </label>
                  <textarea id="ed-excerpt" rows={2} className="excerpt" {...form.text('excerpt')}></textarea>
                </div>

                <div className="field">
                  <span className="label" id="ed-content-label">
                    Contenu *
                  </span>
                  <RichEditor
                    value={form.values.content}
                    onChange={(html) => form.set('content', html)}
                    onBlur={() => form.touch('content')}
                    aria-labelledby="ed-content-label"
                  />
                  <p className="hint">
                    Intertitres, gras, italique, alignement, listes, citations, liens, images (bouton ou glisser-déposer) et vidéos
                    YouTube, Vimeo ou PeerTube.
                  </p>
                </div>
              </div>

              <aside className="side stack">
                <div className="card-flat stack">
                  <div className="field">
                    <label htmlFor="ed-status">Statut</label>
                    <select id="ed-status" {...form.text('status')}>
                      <option value="draft">Brouillon</option>
                      <option value="published" disabled={!canPublish}>
                        Publié
                      </option>
                    </select>
                  </div>
                  {error && (
                    <div className="alert alert-err" role="alert">
                      {error}
                    </div>
                  )}
                  <button type="submit" className="btn" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  {auth.canPublish && form.values.status !== 'published' && (
                    <button type="button" className="btn btn-rouge" disabled={saving} onClick={() => save('published')}>
                      Publier maintenant
                    </button>
                  )}
                </div>

                <div className="card-flat stack">
                  <div className="field">
                    <label htmlFor="ed-cat">Catégorie</label>
                    <select
                      id="ed-cat"
                      value={form.values.category ?? ''}
                      onChange={(e) => form.set('category', e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Aucune —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {!categories.length && <span className="hint">Les catégories se créent dans l'administration Django.</span>}
                  </div>
                </div>

                <div className="card-flat stack">
                  <div className="field">
                    <label htmlFor="ed-cover">Image de couverture</label>
                    {coverSrc && (
                      <>
                        <img src={coverSrc} alt="Aperçu de l'image de couverture" className="cover-preview" />
                        <button type="button" className="btn-link" onClick={clearCover}>
                          Retirer l'image
                        </button>
                      </>
                    )}
                    <input id="ed-cover" type="file" accept="image/*" onChange={onCover} />
                  </div>
                </div>
              </aside>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
