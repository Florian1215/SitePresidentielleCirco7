import { Link } from 'react-router';
import { useI18n } from '../lib/i18n';
import type { Article } from '../lib/models';
import { photoSrc } from './Photo';
import type { PhotoName } from './Photo';

/** Visuels par défaut des articles sans image : photos de mobilisation (pas de portraits individuels). */
const FALLBACKS: PhotoName[] = [
  'berlinBrandebourg', 'reunionPublique', 'manifBerlin', 'rassemblementPalestine',
  'equipeBerlin', 'interviewBerlin', 'berlinFernsehturm', 'meetingLille',
];

function fallback(id: number) {
  return photoSrc(FALLBACKS[Math.abs(id) % FALLBACKS.length], 800);
}

export function ArticleCard({ article: a }: { article: Article }) {
  const i18n = useI18n();
  return (
    <Link
      to={`/blog/${a.slug}`}
      className="flex h-full flex-col overflow-hidden rounded-site bg-white text-inherit no-underline shadow-site transition-transform duration-150 ease-[ease] hover:-translate-y-[3px]"
    >
      <div className="aspect-video bg-lavande">
        <img className="h-full w-full object-cover" src={a.cover_image || fallback(a.id)} alt="" loading="lazy" decoding="async" />
      </div>
      <div className="flex flex-1 flex-col px-[22px] pt-5 pb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {a.status === 'draft' && <span className="badge badge-draft">{i18n.d.article.draft}</span>}
          {a.category_detail && <span className="badge">{a.category_detail.name}</span>}
          <span className="text-[13px] text-texte">{i18n.date(a.published_at || a.created_at)}</span>
        </div>
        <h3 className="mb-2 text-[24px]">{a.title}</h3>
        {a.excerpt && <p className="muted text-[15px]">{a.excerpt}</p>}
        <span className="mt-auto font-bold text-rouge">{i18n.d.article.readMore}</span>
      </div>
    </Link>
  );
}
