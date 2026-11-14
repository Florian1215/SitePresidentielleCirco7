import { useEffect, useRef, useState } from 'react';
import type QuillType from 'quill';
import 'quill/dist/quill.snow.css';
import { api, apiErrorMessage } from '../lib/api';
import './RichEditor.css';

/**
 * Éditeur visuel des articles (Quill 2), utilisé comme un champ contrôlé (value / onChange).
 * Même barre d'outils que l'admin Django (backend : blog/static/blog/rich-editor.js).
 * Le HTML produit est nettoyé par le serveur à l'enregistrement (blog/sanitize.py).
 */
const TOOLBAR = [
  [{ header: [2, 3, 4, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
  ['blockquote', 'link', 'image', 'video'],
  ['clean'],
];

const FORMATS = ['header', 'bold', 'italic', 'underline', 'strike', 'align', 'list', 'indent', 'blockquote', 'link', 'image', 'video'];

const LABELS: Record<string, string> = {
  'ql-bold': 'Gras (Ctrl/⌘ + B)',
  'ql-italic': 'Italique (Ctrl/⌘ + I)',
  'ql-underline': 'Souligné (Ctrl/⌘ + U)',
  'ql-strike': 'Barré',
  'ql-blockquote': 'Citation',
  'ql-link': 'Lien',
  'ql-image': 'Insérer une image',
  'ql-video': 'Insérer une vidéo (YouTube, Vimeo, PeerTube)',
  'ql-clean': 'Effacer la mise en forme',
  'ql-header': 'Titre',
  'ql-align': 'Alignement',
  'ql-list': 'Liste',
  'ql-indent': 'Retrait',
};

interface Props {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  'aria-labelledby'?: string;
}

export function RichEditor({ value, onChange, onBlur, disabled = false, placeholder = 'Rédigez votre article…', ...rest }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const quillRef = useRef<QuillType | null>(null);
  /** Dernier HTML connu (émis par l'éditeur ou reçu) : évite de réécrire le contenu pendant la saisie. */
  const current = useRef(value);
  const callbacks = useRef({ onChange, onBlur });
  callbacks.current = { onChange, onBlur };

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);
  const say = (message: string, isError = false) => {
    setStatus(message);
    setStatusError(isError);
  };

  /** HTML propre (Quill 2.0.3 remplace les espaces par des insécables : on les rétablit). */
  const html = (q: QuillType) => {
    if (q.getLength() <= 1 && !q.root.querySelector('img, iframe')) return '';
    return q.getSemanticHTML().replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
  };

  const setHtml = (q: QuillType, content: string) => {
    q.setContents(q.clipboard.convert({ html: content || '' }), 'silent');
  };

  useEffect(() => {
    let cancelled = false;
    const el = area.current!;
    const container = el.parentElement!;

    const insertFiles = (range: { index: number } | null, files: File[]) => {
      const q = quillRef.current;
      if (!q) return;
      let index = range?.index ?? q.getLength();
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        say(`Envoi de l'image « ${file.name} »…`);
        api.uploadArticleImage(file).then(
          ({ url }) => {
            q.insertEmbed(index, 'image', url, 'user');
            index += 1;
            q.setSelection(index, 0, 'silent');
            say('');
          },
          (err) => say(`Image non envoyée : ${apiErrorMessage(err)}`, true),
        );
      }
    };

    const pickImage = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/gif';
      input.onchange = () => insertFiles(quillRef.current?.getSelection(true) ?? null, Array.from(input.files ?? []));
      input.click();
    };

    import('quill').then(({ default: Quill }) => {
      if (cancelled) return;
      const quill = new Quill(el, {
        theme: 'snow',
        formats: FORMATS,
        placeholder,
        modules: {
          toolbar: { container: TOOLBAR, handlers: { image: pickImage } },
          // Images glissées ou collées : envoyées sur le serveur (pas d'image intégrée en base64)
          uploader: { handler: (range: { index: number } | null, files: File[]) => insertFiles(range, files) },
        },
      });
      quillRef.current = quill;
      setHtml(quill, current.current);
      quill.on('text-change', () => {
        current.current = html(quill);
        callbacks.current.onChange(current.current);
      });
      quill.root.addEventListener('blur', () => callbacks.current.onBlur?.());
      for (const [cls, label] of Object.entries(LABELS)) {
        container.querySelectorAll<HTMLElement>('.' + cls).forEach((b) => b.setAttribute('title', label));
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
      quillRef.current = null;
      container.querySelectorAll('.ql-toolbar').forEach((t) => t.remove());
      el.className = '';
      el.innerHTML = '';
    };
    // L'éditeur est créé une seule fois
  }, []);

  // Valeur reçue de l'extérieur (article chargé en modification)
  useEffect(() => {
    const q = quillRef.current;
    if (value === current.current) return;
    current.current = value;
    if (q) setHtml(q, value);
  }, [value]);

  useEffect(() => {
    quillRef.current?.enable(!disabled);
  }, [disabled, ready]);

  return (
    <div className="rich-editor-host" aria-labelledby={rest['aria-labelledby']}>
      <div className={`rich-editor${disabled ? ' disabled' : ''}`}>
        <div ref={area}></div>
        {!ready && <p className="rich-editor-loading">Chargement de l'éditeur…</p>}
      </div>
      {status && (
        <p className={`rich-editor-status${statusError ? ' error' : ''}`} role="status">
          {status}
        </p>
      )}
    </div>
  );
}
