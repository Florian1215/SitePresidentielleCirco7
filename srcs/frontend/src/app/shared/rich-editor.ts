import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type QuillType from 'quill';
import { ApiService, apiErrorMessage } from '../core/api.service';

/**
 * Éditeur visuel des articles (Quill 2), utilisable comme un champ de formulaire (formControlName).
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

@Component({
  selector: 'app-rich-editor',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichEditor), multi: true }],
  // Quill crée son propre DOM : ses styles (et les nôtres) doivent s'appliquer sans encapsulation
  encapsulation: ViewEncapsulation.None,
  styleUrl: '../../../node_modules/quill/dist/quill.snow.css',
  template: `
    <div class="rich-editor" [class.disabled]="disabled()">
      <div #area></div>
      @if (!ready()) { <p class="rich-editor-loading">Chargement de l'éditeur…</p> }
    </div>
    @if (status()) {
      <p class="rich-editor-status" [class.error]="statusError()" role="status">{{ status() }}</p>
    }
  `,
  styles: `
    app-rich-editor { display: block; }
    app-rich-editor .rich-editor { background: #fff; border-radius: var(--radius); }
    app-rich-editor .ql-toolbar.ql-snow {
      position: sticky; top: 76px; z-index: 3;
      background: var(--gris-clair); border: 1px solid var(--noir);
      border-radius: var(--radius) var(--radius) 0 0; font-family: var(--font-texte);
    }
    app-rich-editor .ql-container.ql-snow {
      border: 1px solid var(--noir); border-top: 0; border-radius: 0 0 var(--radius) var(--radius);
      font-family: var(--font-texte); font-size: 18px;
    }
    app-rich-editor .ql-editor { min-height: 460px; padding: 24px 28px; line-height: 1.7; color: var(--noir); }
    app-rich-editor .ql-editor.ql-blank::before { font-style: normal; color: var(--gris-moyen); left: 28px; }
    app-rich-editor .ql-editor h2 { font-family: var(--font-titre); font-size: 34px; color: var(--violet); text-transform: uppercase; margin: 1.2em 0 .4em; }
    app-rich-editor .ql-editor h3 { font-family: var(--font-titre); font-size: 26px; color: var(--violet); margin: 1.1em 0 .4em; }
    app-rich-editor .ql-editor h4 { font-size: 20px; margin: 1em 0 .4em; }
    app-rich-editor .ql-editor p { margin-bottom: .8em; }
    app-rich-editor .ql-editor blockquote { border-left: 6px solid var(--rouge); padding-left: 20px; font-weight: 500; font-size: 20px; }
    app-rich-editor .ql-editor img { border-radius: 8px; max-width: 100%; }
    app-rich-editor .ql-editor .ql-video { width: 100%; height: auto; aspect-ratio: 16 / 9; }
    app-rich-editor .ql-snow .ql-tooltip { z-index: 4; }
    app-rich-editor .rich-editor-loading { padding: 24px; color: var(--texte); }
    app-rich-editor .rich-editor-status { margin: 8px 0 0; font-size: 14px; color: var(--violet); }
    app-rich-editor .rich-editor-status.error { color: var(--rouge); font-weight: 700; }
    app-rich-editor .disabled { opacity: .6; pointer-events: none; }
  `,
})
export class RichEditor implements ControlValueAccessor {
  readonly placeholder = input('Rédigez votre article…');

  private api = inject(ApiService);
  private area = viewChild.required<ElementRef<HTMLDivElement>>('area');
  private quill?: QuillType;
  private pending = '';
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected ready = signal(false);
  protected disabled = signal(false);
  protected status = signal('');
  protected statusError = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(async () => {
      const { default: Quill } = await import('quill');
      const quill = new Quill(this.area().nativeElement, {
        theme: 'snow',
        formats: FORMATS,
        placeholder: this.placeholder(),
        modules: {
          toolbar: { container: TOOLBAR, handlers: { image: () => this.pickImage() } },
          // Images glissées ou collées : envoyées sur le serveur (pas d'image intégrée en base64)
          uploader: { handler: (range: { index: number } | null, files: File[]) => this.insertFiles(range, files) },
        },
      });
      this.quill = quill;
      this.setHtml(this.pending);
      quill.on('text-change', () => this.onChange(this.html()));
      quill.root.addEventListener('blur', () => this.onTouched());
      quill.enable(!this.disabled());

      const container = this.area().nativeElement.parentElement!;
      for (const [cls, label] of Object.entries(LABELS)) {
        container.querySelectorAll<HTMLElement>('.' + cls).forEach((el) => el.setAttribute('title', label));
      }
      this.ready.set(true);
      destroyRef.onDestroy(() => (this.quill = undefined));
    });
  }

  /** HTML propre (Quill 2.0.3 remplace les espaces par des insécables : on les rétablit). */
  private html() {
    const q = this.quill;
    if (!q) return this.pending;
    if (q.getLength() <= 1 && !q.root.querySelector('img, iframe')) return '';
    return q.getSemanticHTML().replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
  }

  private setHtml(html: string) {
    const q = this.quill;
    if (!q) return;
    q.setContents(q.clipboard.convert({ html: html || '' }), 'silent');
  }

  private say(message: string, isError = false) {
    this.status.set(message);
    this.statusError.set(isError);
  }

  private pickImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';
    input.onchange = () => this.insertFiles(this.quill?.getSelection(true) ?? null, Array.from(input.files ?? []));
    input.click();
  }

  private insertFiles(range: { index: number } | null, files: File[]) {
    const q = this.quill;
    if (!q) return;
    let index = range?.index ?? q.getLength();
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      this.say(`Envoi de l'image « ${file.name} »…`);
      this.api.uploadArticleImage(file).subscribe({
        next: ({ url }) => {
          q.insertEmbed(index, 'image', url, 'user');
          index += 1;
          q.setSelection(index, 0, 'silent');
          this.say('');
        },
        error: (err) => this.say(`Image non envoyée : ${apiErrorMessage(err)}`, true),
      });
    }
  }

  // ---------- ControlValueAccessor ----------
  writeValue(value: string | null) {
    this.pending = value ?? '';
    this.setHtml(this.pending);
  }
  registerOnChange(fn: (v: string) => void) {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void) {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean) {
    this.disabled.set(disabled);
    this.quill?.enable(!disabled);
  }
}
