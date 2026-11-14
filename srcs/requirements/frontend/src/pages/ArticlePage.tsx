import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, apiErrorMessage } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Article } from '../lib/models';

/** --cover-h : hauteur de l'image de couverture. */
const COVER = { '--cover-h': 'clamp(380px, 58vw, 760px)' } as CSSProperties;

export default function ArticlePage() {
  const { slug = '' } = useParams();
  const i18n = useI18n();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    setArticle(null);
    setNotFound(false);
    api.article(slug, ctrl.signal).then(setArticle, (err) => {
      if ((err as Error)?.name !== 'AbortError') setNotFound(true);
    });
    return () => ctrl.abort();
  }, [slug]);

  // Titre de l'onglet : celui de l'article
  useEffect(() => {
    if (article) document.title = `${article.title} — ${i18n.d.titles.suffix}`;
  }, [article, i18n]);

  const remove = async (s: string) => {
    try {
      await api.deleteArticle(s);
      navigate('/blog');
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  if (article) {
    const a = article;
    const cover = !!a.cover_image;
    return (
      <article>
        {/* En-tête : sans image, simple bandeau ; avec image, l'image en fond qui se fond vers le texte */}
        <header
          className={`relative pt-[clamp(48px,7vw,88px)] pb-[clamp(24px,4vw,40px)] ${cover ? 'pt-[calc(var(--cover-h)-110px)]!' : ''}`}
          style={cover ? COVER : undefined}
        >
          {cover && (
            // Légère ombre en haut (bouton retour) et fondu vers le fond crème en bas
            <div
              className="absolute inset-x-0 top-0 h-(--cover-h) overflow-hidden after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(33,35,32,.3)_0,rgba(33,35,32,0)_120px),linear-gradient(180deg,rgba(255,252,244,0)_70%,rgba(255,252,244,.85)_90%,var(--color-creme)_100%)] after:content-['']"
              aria-hidden="true"
            >
              <img className="block h-full w-full object-cover object-center" src={a.cover_image!} alt="" fetchPriority="high" />
            </div>
          )}
          <div className="site-container max-w-[820px] relative z-1">
            <Link
              to="/blog"
              className={`mb-5 inline-block font-bold no-underline ${cover ? 'absolute top-[calc(-1*var(--cover-h)+110px+28px)] rounded-full bg-[rgba(255,252,244,.92)] px-3 py-1.5' : ''}`}
            >
              {i18n.d.article.back}
            </Link>
            <div className="mb-3 flex gap-2">
              {a.status === 'draft' && <span className="badge badge-draft">Brouillon — non publié</span>}
              {a.category_detail && (
                <Link className="badge no-underline" to={`/blog?category=${encodeURIComponent(a.category_detail.slug)}`}>
                  {a.category_detail.name}
                </Link>
              )}
            </div>
            <h1 className="text-[clamp(36px,6vw,64px)] leading-[1.05]">{a.title}</h1>
            {a.excerpt && <p className="lead">{a.excerpt}</p>}
            <p className="muted mb-5">
              {i18n.d.article.by} <strong>{a.author_name}</strong>
              {a.published_at && <> · {i18n.date(a.published_at)}</>}
            </p>
            {(a.can_edit || a.can_delete) && (
              <>
                <div className="btn-row">
                  {a.can_edit && (
                    <Link to={`/blog/${a.slug}/modifier`} className="btn btn-sm">
                      Modifier
                    </Link>
                  )}
                  {a.can_delete &&
                    (confirming ? (
                      <>
                        <span className="self-center font-bold text-rouge">Supprimer définitivement ?</span>
                        <button type="button" className="btn btn-rouge btn-sm" onClick={() => remove(a.slug)}>
                          Oui, supprimer
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(false)}>
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirming(true)}>
                        Supprimer
                      </button>
                    ))}
                </div>
                {actionError && <div className="alert alert-err mt-3">{actionError}</div>}
              </>
            )}
          </div>
        </header>
        {/* Le texte passe au-dessus du reflet, qui peut descendre plus bas que l'en-tête */}
        <div className="section-sm relative z-1 pt-2!">
          <div className="site-container max-w-[820px]">
            {/*
              Le contenu est nettoyé par le serveur à chaque enregistrement (backend : blog/sanitize.py, liste blanche
              de balises). On l'affiche tel quel pour garder l'alignement (classes) et les vidéos intégrées (iframes).
            */}
            <div className="prose" dangerouslySetInnerHTML={{ __html: a.content ?? '' }} />
          </div>
        </div>
      </article>
    );
  }

  if (notFound) {
    return (
      <section className="section">
        <div className="site-container max-w-[820px]">
          <h1 className="h2">{i18n.d.article.notFoundTitle}</h1>
          <p>{i18n.d.article.notFoundText}</p>
          <Link to="/blog" className="btn">
            {i18n.d.article.backToNews}
          </Link>
        </div>
      </section>
    );
  }

  return <p className="loader">{i18n.d.article.loading}</p>;
}
