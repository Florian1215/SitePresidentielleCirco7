import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CoverCropper } from '../components/CoverCropper';
import { RichEditor } from '../components/RichEditor';
import { SignaturePicker } from '../components/SignaturePicker';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { maxLength, required, useForm } from '../lib/forms';
import type { ArticleStatus, Category, Signer, Signers } from '../lib/models';
import { notifyPendingChanged } from '../lib/pending';
import { usePageTitle } from '../lib/title';

export default function ArticleEditor() {
  /** Présent uniquement en modification (route blog/:slug/modifier). */
  const { slug } = useParams();
  usePageTitle(slug ? "Modifier l'article" : 'Écrire un article');
  const navigate = useNavigate();
  const auth = useAuth();
  const me = auth.user;

  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [currentCover, setCurrentCover] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  /** Statut de l'article à son ouverture (null : nouvel article). */
  const [initialStatus, setInitialStatus] = useState<ArticleStatus | null>(null);
  const wasPublished = initialStatus === 'published';
  /** Signature : comptes auteur·ices et signatures collectives (par défaut, le compte connecté). */
  const [signers, setSigners] = useState<Signers>({ authors: [], collectives: [] });
  const [authors, setAuthors] = useState<Signer[]>(() =>
    !slug && me ? [{ id: me.id, name: [me.first_name, me.last_name].filter(Boolean).join(' ') || me.username }] : [],
  );
  const [collectives, setCollectives] = useState<number[]>([]);
  const coverFile = useRef<File | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  /** Image d'origine choisie (avant recadrage), pour pouvoir la recadrer à nouveau. */
  const [original, setOriginal] = useState<{ src: string; name: string } | null>(null);
  /** Fenêtre de recadrage ouverte sur cette image. */
  const [cropping, setCropping] = useState<{ src: string; name: string } | null>(null);

  const form = useForm(
    { title: '', excerpt: '', content: '', category: null as number | null, status: 'draft' },
    { title: [required, maxLength(200)], excerpt: [maxLength(400)], content: [required] },
  );

  useEffect(() => {
    api.categories().then(setCategories, () => {});
    api.signers().then(setSigners, () => {});
    if (!slug) return;
    api.article(slug).then(
      (a) => {
        if (!a.can_edit) {
          setLoadError("Vous n'avez pas le droit de modifier cet article.");
          return;
        }
        form.setValues({ title: a.title, excerpt: a.excerpt, content: a.content ?? '', category: a.category, status: a.status });
        setInitialStatus(a.status);
        setCurrentCover(a.cover_image);
        setAuthors(a.authors_detail);
        setCollectives(a.collectives_detail.map((c) => c.id));
      },
      () => setLoadError('Article introuvable.'),
    );
  }, [slug]);

  /** Image choisie : on l'ouvre aussitôt dans la fenêtre de recadrage. */
  const onCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // pour pouvoir rechoisir le même fichier
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError("Ce fichier n'est pas une image.");
      return;
    }
    setCropping({ src: URL.createObjectURL(file), name: file.name });
  };

  const onCropped = (file: File) => {
    // La nouvelle image d'origine remplace la précédente
    if (cropping && cropping.src !== original?.src) {
      if (original?.src.startsWith('blob:')) URL.revokeObjectURL(original.src);
      setOriginal(cropping);
    }
    coverFile.current = file;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(file));
    setCropping(null);
    setError('');
  };

  const onCropCancel = () => {
    if (cropping && cropping.src !== original?.src && cropping.src.startsWith('blob:')) URL.revokeObjectURL(cropping.src);
    setCropping(null);
  };

  /** Recadrer à nouveau : depuis l'image d'origine choisie, sinon depuis l'image déjà en ligne. */
  const recrop = () => {
    if (original) setCropping(original);
    else if (currentCover) setCropping({ src: currentCover, name: 'couverture.jpg' });
  };

  const save = async (status?: ArticleStatus) => {
    const v = status ? { ...form.values, status } : form.values;
    if (status) form.set('status', status);
    setError('');
    if (form.invalid) {
      form.touchAll();
      setError('Le titre et le contenu sont obligatoires.');
      return;
    }
    if (!coverFile.current && !currentCover) {
      setError("L'image de couverture est obligatoire.");
      return;
    }
    if (!authors.length && !collectives.length) {
      setError('Choisissez au moins un·e auteur·ice ou une signature collective.');
      return;
    }
    setSaving(true);
    try {
      const a = await api.saveArticle(
        {
          ...v,
          category: v.category ? Number(v.category) : null,
          cover: coverFile.current,
          authors: authors.map((a) => a.id),
          collectives,
        },
        slug,
      );
      setSaving(false);
      notifyPendingChanged();
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
    <section className="section-sm">
      <div className="site-container">
        <Link to="/blog" className="mb-4 inline-block font-bold no-underline">
          ← Retour aux actualités
        </Link>
        <h1 className="h2">{slug ? "Modifier l'article" : 'Écrire un article'}</h1>

        {loadError ? (
          <div className="alert alert-err">{loadError}</div>
        ) : (
          <>
            {!wasPublished && !auth.isSuperAdmin && (
              <div className="alert alert-info mb-6">
                Enregistrez votre article en brouillon, puis <strong>envoyez-le en validation</strong> : il sera publié dès que 2
                autres comptes l'auront validé (page « À valider »).
              </div>
            )}

            <form onSubmit={onSubmit} className="grid grid-cols-[1fr_300px] items-start gap-8 max-[900px]:grid-cols-1" noValidate>
              <div className="stack">
                <div className="field">
                  <label htmlFor="ed-title">Titre *</label>
                  <input id="ed-title" type="text" className="font-titre text-[28px] text-violet" {...form.text('title')} />
                </div>
                <div className="field">
                  <label htmlFor="ed-excerpt">
                    Chapô <span className="hint">(résumé affiché dans la liste, 400 caractères max.)</span>
                  </label>
                  <textarea id="ed-excerpt" rows={2} className="min-h-[70px]" {...form.text('excerpt')}></textarea>
                </div>

                <div className="field">
                  <span className="text-[14px] font-bold" id="ed-content-label">
                    Contenu *
                  </span>
                  <RichEditor
                    value={form.values.content}
                    onChange={(html) => form.set('content', html)}
                    onBlur={() => form.touch('content')}
                    aria-labelledby="ed-content-label"
                  />
                  <p className="hint">
                    Intertitres, gras, italique, alignement, listes, citations, liens, images (bouton ou glisser-déposer) et
                    vidéos YouTube, Vimeo ou PeerTube.
                  </p>
                </div>
              </div>

              <aside className="stack sticky top-[100px] max-[900px]:static">
                <div className="card-flat stack">
                  <div className="field">
                    <label htmlFor="ed-status">Statut</label>
                    <select id="ed-status" {...form.text('status')}>
                      <option value="draft">Brouillon</option>
                      <option value="pending">À valider</option>
                      {(wasPublished || auth.isSuperAdmin) && <option value="published">Publié</option>}
                    </select>
                  </div>
                  {error && (
                    <div className="alert alert-err" role="alert">
                      {error}
                    </div>
                  )}
                  <button type="submit" className="btn w-full" disabled={saving}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  {form.values.status === 'draft' && (
                    <button type="button" className="btn btn-rouge w-full" disabled={saving} onClick={() => save('pending')}>
                      Envoyer en validation
                    </button>
                  )}
                  {auth.isSuperAdmin && !wasPublished && form.values.status !== 'published' && (
                    <button type="button" className="btn btn-outline w-full" disabled={saving} onClick={() => save('published')}>
                      🚀 Publier maintenant
                    </button>
                  )}
                  {initialStatus === 'pending' && (
                    <p className="hint m-0">Enregistrer une modification remet les validations de l'article à zéro.</p>
                  )}
                </div>

                <div className="card-flat stack">
                  <SignaturePicker
                    options={signers}
                    authors={authors}
                    collectives={collectives}
                    meId={me?.id}
                    onChange={(a, c) => {
                      setAuthors(a);
                      setCollectives(c);
                    }}
                  />
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
                    {auth.canManageTaxonomy && (
                      <Link to="/redaction/articles#categories-auteurs" className="hint">
                        Gérer les catégories et les signatures collectives
                      </Link>
                    )}
                  </div>
                </div>

                <div className="card-flat stack">
                  <div className="field">
                    <label htmlFor="ed-cover">Image de couverture *</label>
                    {coverSrc ? (
                      <>
                        <img
                          src={coverSrc}
                          alt="Aperçu de l'image de couverture"
                          className="aspect-video w-full rounded-lg object-cover"
                        />
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <button type="button" className="btn-link" onClick={recrop}>
                            Recadrer
                          </button>
                          <button type="button" className="btn-link" onClick={() => coverInput.current?.click()}>
                            Changer l'image
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="grid aspect-video w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed border-violet bg-lavande [font-family:inherit] text-[15px] font-bold text-violet hover:bg-white"
                        onClick={() => coverInput.current?.click()}
                      >
                        + Choisir une image
                      </button>
                    )}
                    <input
                      ref={coverInput}
                      id="ed-cover"
                      type="file"
                      accept="image/*"
                      className="visually-hidden"
                      tabIndex={-1}
                      onChange={onCover}
                    />
                    <span className="hint">Format 16:9 : vous choisissez la partie de l'image à garder.</span>
                  </div>
                </div>
              </aside>
            </form>

            {cropping && <CoverCropper src={cropping.src} name={cropping.name} onDone={onCropped} onCancel={onCropCancel} />}
          </>
        )}
      </div>
    </section>
  );
}
