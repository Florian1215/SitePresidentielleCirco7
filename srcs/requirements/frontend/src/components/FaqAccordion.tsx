import { useId, useState } from 'react';

export interface FaqItem {
  id: number;
  q: string;
  a: string;
}

/** Couleur des questions (violet du site, fond lavande). */
const COLOR = '[--c-fond:var(--color-lavande)] [--c:var(--color-violet)]';

/**
 * Questions fréquentes en accordéon (violet) : numéro, bouton « + » qui pivote en « × »,
 * réponse qui se déplie en douceur dans une bulle. Plusieurs réponses peuvent être ouvertes à la fois.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const baseId = useId();
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="grid gap-3.5">
      {items.map((item, i) => {
        const isOpen = open.has(item.id);
        const btnId = `${baseId}-q${item.id}`;
        const panelId = `${baseId}-a${item.id}`;
        return (
          <div
            key={item.id}
            className={`${COLOR} rounded-2xl border-2 bg-white transition-[border-color,box-shadow,translate] duration-200 motion-reduce:transition-none ${
              isOpen
                ? 'border-(--c) shadow-[0_12px_28px_rgba(33,35,32,0.10)]'
                : 'border-transparent shadow-site hover:-translate-y-0.5 hover:border-(--c-fond)'
            }`}
          >
            <h3 className="m-0">
              <button
                type="button"
                id={btnId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="group flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent px-5 py-4 text-left [font-family:inherit] max-[600px]:gap-3 max-[600px]:px-4"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-titre text-[22px] transition-[background,color,rotate] duration-300 motion-reduce:transition-none ${
                    isOpen ? '-rotate-6 bg-(--c) text-white' : 'bg-(--c-fond) text-(--c) group-hover:-rotate-6'
                  }`}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-[17px] leading-[1.35] font-bold text-violet">{item.q}</span>
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-[background,color,rotate] duration-300 motion-reduce:transition-none ${
                    isOpen ? 'rotate-45 bg-(--c) text-white' : 'bg-(--c-fond) text-(--c)'
                  }`}
                  aria-hidden="true"
                >
                  <svg className="h-4 w-4 stroke-current stroke-[3] [stroke-linecap:round]" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v12M2 8h12" />
                  </svg>
                </span>
              </button>
            </h3>

            {/* Dépliage animé : la ligne de grille passe de 0fr à 1fr */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              inert={!isOpen}
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div
                  className={`px-5 pb-5 pl-[80px] transition-[opacity,translate] duration-300 motion-reduce:transition-none max-[600px]:pl-4 ${
                    isOpen ? 'translate-y-0 opacity-100 delay-75' : '-translate-y-2 opacity-0'
                  }`}
                >
                  <p className="m-0 rounded-2xl rounded-tl-sm bg-(--c-fond) px-5 py-4 whitespace-pre-line text-noir">{item.a}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
