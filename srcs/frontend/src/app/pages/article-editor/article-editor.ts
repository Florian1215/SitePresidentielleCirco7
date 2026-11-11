import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, apiErrorMessage } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Category } from '../../core/models';
import { RichEditor } from '../../shared/rich-editor';

@Component({
  selector: 'app-article-editor',
  imports: [ReactiveFormsModule, RouterLink, RichEditor],
  templateUrl: './article-editor.html',
  styleUrl: './article-editor.scss',
})
export class ArticleEditor implements OnInit {
  /** Présent uniquement en modification (route blog/:slug/modifier). */
  readonly slug = input<string>();

  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  protected categories = signal<Category[]>([]);
  protected saving = signal(false);
  protected error = signal('');
  protected loadError = signal('');
  protected currentCover = signal<string | null>(null);
  protected coverPreview = signal<string | null>(null);
  protected wasPublished = signal(false);
  private coverFile: File | null = null;
  private removeCover = false;

  protected form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    excerpt: ['', Validators.maxLength(400)],
    content: ['', Validators.required],
    category: [null as number | null],
    status: ['draft'],
  });

  protected canPublish = computed(() => this.auth.canPublish() || this.wasPublished());

  ngOnInit() {
    this.api.categories().subscribe({ next: (c) => this.categories.set(c), error: () => {} });
    const slug = this.slug();
    if (!slug) return;
    this.api.article(slug).subscribe({
      next: (a) => {
        if (!a.can_edit) {
          this.loadError.set("Vous n'avez pas le droit de modifier cet article.");
          return;
        }
        this.form.setValue({
          title: a.title,
          excerpt: a.excerpt,
          content: a.content ?? '',
          category: a.category,
          status: a.status,
        });
        this.wasPublished.set(a.status === 'published');
        this.currentCover.set(a.cover_image);
      },
      error: () => this.loadError.set('Article introuvable.'),
    });
  }

  onCover(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.coverFile = file;
    this.removeCover = false;
    const prev = this.coverPreview();
    if (prev) URL.revokeObjectURL(prev);
    this.coverPreview.set(file ? URL.createObjectURL(file) : null);
  }

  clearCover() {
    this.coverFile = null;
    this.removeCover = true;
    this.currentCover.set(null);
    this.coverPreview.set(null);
  }

  save(status?: 'draft' | 'published') {
    if (status) this.form.controls.status.setValue(status);
    this.error.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Le titre et le contenu sont obligatoires.');
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .saveArticle(
        { ...v, category: v.category ? Number(v.category) : null, cover: this.coverFile, removeCover: this.removeCover },
        this.slug(),
      )
      .subscribe({
        next: (a) => {
          this.saving.set(false);
          this.router.navigate(['/blog', a.slug]);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(apiErrorMessage(err));
        },
      });
  }
}
