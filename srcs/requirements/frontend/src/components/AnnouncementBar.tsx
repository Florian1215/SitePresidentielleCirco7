import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { Announcement } from '../lib/models';

/** Vitesse de défilement, en pixels par seconde (la même quelle que soit la longueur des messages). */
const SPEED = 70;

/**
 * Bandeau défilant en haut du site, avec les messages actifs de l'admin Django (« Messages du bandeau »).
 * Rien n'est affiché sans message. Les messages sont répétés autant de fois qu'il faut pour remplir toute la largeur,
 * et cette suite est rendue deux fois côte à côte : chaque copie avance de sa propre largeur, ce qui donne une boucle
 * sans fin et sans à-coup. Le défilement s'arrête au survol et pour qui a demandé moins d'animations.
 */
export function AnnouncementBar() {
  const i18n = useI18n();
  const [items, setItems] = useState<Announcement[]>([]);
  /** Nombre de répétitions des messages dans chaque copie, et durée d'un tour. */
  const [fill, setFill] = useState({ reps: 1, duration: 30 });
  const bar = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let alive = true;
    api.announcements().then(
      (list) => alive && setItems(list),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  const texts = items.map((a) => (i18n.lang === 'en' ? a.text_en : i18n.lang === 'de' ? a.text_de : '') || a.text_fr);
  const key = texts.join('\n');

  // Mesure de la largeur d'une suite de messages : assez de répétitions pour couvrir le bandeau (recalculé au redimensionnement)
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || !texts.length) return;
    const measure = () => {
      const copy = copyRef.current;
      if (!copy) return;
      const one = copy.scrollWidth / Number(copy.dataset.reps || 1);
      if (!one) return;
      const reps = Math.max(1, Math.ceil(el.clientWidth / one));
      const duration = (one * reps) / SPEED;
      setFill((f) => (f.reps === reps && Math.abs(f.duration - duration) < 0.5 ? f : { reps, duration }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (copyRef.current) observer.observe(copyRef.current); // largeur réelle une fois la police chargée
    return () => observer.disconnect();
  }, [key]);

  if (!texts.length) return null;

  const sequence = Array.from({ length: fill.reps }, () => texts).flat();
  const copy = (hidden: boolean) => (
    <ul
      ref={hidden ? undefined : copyRef}
      data-reps={fill.reps}
      aria-hidden={hidden || undefined}
      className="m-0 flex w-max shrink-0 list-none items-center p-0 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
    >
      {sequence.map((text, i) => (
        // Pour les lecteurs d'écran, chaque message n'est lu qu'une fois
        <li key={i} aria-hidden={(!hidden && i >= texts.length) || undefined} className="flex items-center whitespace-nowrap">
          <span className="px-6">{text}</span>
          <span aria-hidden="true" className="text-jaune">
            ✦
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      ref={bar}
      className="group flex overflow-hidden bg-violet py-2 text-[14px] font-bold text-creme"
      style={{ '--marquee-duration': `${fill.duration}s` } as CSSProperties}
    >
      {copy(false)}
      {copy(true)}
    </div>
  );
}
