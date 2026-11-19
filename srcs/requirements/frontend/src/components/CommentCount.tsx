import { Link } from 'react-router';

/** « 💬 3 commentaires · 2 à traiter » : lien vers les commentaires de relecture d'un article. */
export function CommentCount({
  slug,
  total,
  open,
  className = '',
}: {
  slug: string;
  total: number;
  open: number;
  className?: string;
}) {
  return (
    <Link
      to={`/blog/${slug}#commentaires`}
      className={`inline-flex items-center gap-1.5 font-bold no-underline hover:underline ${className}`}
    >
      <span aria-hidden="true">💬</span>
      {total} commentaire{total > 1 ? 's' : ''}
      {open > 0 && <span className="rounded-full bg-jaune px-2 py-0.5 text-[12px] text-noir">{open} à traiter</span>}
    </Link>
  );
}
