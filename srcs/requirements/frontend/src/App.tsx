import { Suspense, lazy, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { useAuth } from './lib/auth';

// Pages chargées à la demande (un fichier JS par page)
const Home = lazy(() => import('./pages/Home'));
const Programme = lazy(() => import('./pages/Programme'));
const Circonscription = lazy(() => import('./pages/Circonscription'));
const Voter = lazy(() => import('./pages/Voter'));
const ImpotUniversel = lazy(() => import('./pages/ImpotUniversel'));
const BlogList = lazy(() => import('./pages/BlogList'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const ArticleEditor = lazy(() => import('./pages/ArticleEditor'));
const Contact = lazy(() => import('./pages/Contact'));
const Legal = lazy(() => import('./pages/SmallPages').then((m) => ({ default: m.Legal })));
const Login = lazy(() => import('./pages/SmallPages').then((m) => ({ default: m.Login })));
const NotFound = lazy(() => import('./pages/SmallPages').then((m) => ({ default: m.NotFound })));

/** Autorise l'accès si l'utilisateur possède la permission Django donnée. */
function RequirePerm({ perm, children }: { perm: string; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.isLoggedIn) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/connexion?next=${next}`} replace />;
  }
  return auth.hasPerm(perm) ? children : <Navigate to="/blog" replace />;
}

/**
 * Défilement à chaque navigation : en haut de la page, ou jusqu'à l'ancre (#agenda…) si l'adresse en a une.
 * La page pouvant être chargée à la demande, l'ancre est recherchée pendant un court instant.
 */
function ScrollManager() {
  const { key, hash } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current && !hash) {
      first.current = false;
      return;
    }
    first.current = false;
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let tries = 0;
    let timer = 0;
    const find = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView();
      else if (tries++ < 40) timer = window.setTimeout(find, 50);
    };
    find();
    return () => clearTimeout(timer);
  }, [key, hash]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollManager />
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <Header />
      <main id="contenu" tabIndex={-1}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/programme" element={<Programme />} />
            <Route path="/circonscription" element={<Circonscription />} />
            <Route path="/inscription-listes-electorales" element={<Voter />} />
            {/* Simulateur de l'impôt universel : pas encore lié depuis le site (ni menu, ni pied de page) */}
            <Route path="/impot-universel" element={<ImpotUniversel />} />
            <Route path="/agenda" element={<Navigate to="/blog" replace />} />
            <Route path="/blog" element={<BlogList />} />
            <Route
              path="/blog/ecrire"
              element={
                <RequirePerm perm="blog.add_article">
                  <ArticleEditor />
                </RequirePerm>
              }
            />
            <Route
              path="/blog/:slug/modifier"
              element={
                <RequirePerm perm="blog.change_article">
                  <ArticleEditor key="edit" />
                </RequirePerm>
              }
            />
            <Route path="/blog/:slug" element={<ArticlePage />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/connexion" element={<Login />} />
            <Route path="/mentions-legales" element={<Legal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
