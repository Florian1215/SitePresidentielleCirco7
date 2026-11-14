import './index.css';
import './styles/global.scss';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { restoreAuth } from './lib/auth';
import { initLang } from './lib/i18n';

initLang();

// Comme l'ancienne application : on attend de savoir qui est connecté·e avant d'afficher le site
// (immédiat sans jeton enregistré).
restoreAuth().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  );
});
