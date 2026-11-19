import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { CAMPAIGN } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { Photo } from './Photo';

/**
 * Encart « Nous sommes N à soutenir la candidature de Jean-Luc Mélenchon » :
 * compteur Action populaire qui défile à l'arrivée à l'écran. Utilisé sur l'accueil et la page « Je soutiens ».
 */
export function SupportMelenchon({ id }: { id?: string }) {
  const i18n = useI18n();
  const t = i18n.d.home;
  const c = CAMPAIGN;

  // ---------- Compteur de soutiens (Action populaire) ----------
  const soutien = useRef<HTMLElement>(null);
  const [supporters, setSupporters] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(0);
  const supportersRef = useRef<number | null>(null);
  const counted = useRef(false);

  useEffect(() => {
    let alive = true;
    const timers: number[] = [];
    let raf = 0;

    const load = () =>
      api.supportersCount().then(
        ({ count }) => {
          if (!alive || count === null) return;
          supportersRef.current = count;
          setSupporters(count);
          // Après la première animation, le chiffre suit simplement les mises à jour
          if (counted.current) setDisplayCount(count);
        },
        () => {},
      );
    load();
    const timer = window.setInterval(load, 30_000);

    const countUp = () => {
      if (!alive) return;
      const target = supportersRef.current;
      if (target === null) {
        // Chiffre pas encore reçu : on réessaie un peu plus tard
        timers.push(window.setTimeout(countUp, 300));
        return;
      }
      counted.current = true;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDisplayCount(target);
        return;
      }
      const start = performance.now();
      const from = Math.round(target * 0.8);
      const duration = 1600;
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        // La valeur peut avoir été mise à jour entre-temps
        const goal = supportersRef.current ?? target;
        setDisplayCount(Math.round(from + (goal - from) * eased));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    // Le chiffre défile quand la section arrive à l'écran
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        countUp();
      },
      { threshold: 0.4 },
    );
    if (soutien.current) observer.observe(soutien.current);
    return () => {
      alive = false;
      clearInterval(timer);
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <section id={id} className="section overflow-hidden bg-lavande" ref={soutien}>
      <div className="site-container grid grid-cols-[1.2fr_1fr] items-center gap-12 max-[900px]:grid-cols-1">
        <div className="hero-copy">
          <p className="m-0 font-titre text-[clamp(28px,3.4vw,40px)] text-violet uppercase">{t.weAre}</p>
          {/* Chiffres à chasse fixe : le nombre ne « danse » pas pendant qu'il défile */}
          <p
            className="mt-1 mb-2 font-titre text-[clamp(64px,11vw,140px)] leading-none text-violet tabular-nums"
            aria-live="polite"
          >
            <span className="inline-block bg-[linear-gradient(transparent_58%,var(--color-jaune)_58%)] px-[0.12em]">
              {supporters !== null ? i18n.number(displayCount) : t.manyThousands}
            </span>
          </p>
          <p className="m-0 mb-2.5 font-titre text-[clamp(24px,3vw,34px)] leading-[1.1] text-rouge uppercase">{t.supportLead}</p>
          <p className="muted">{t.supportText}</p>
          <div className="btn-row mt-6">
            <a href={c.links.soutenir} target="_blank" rel="noopener" className="btn btn-rouge">
              {t.supportBtn}
            </a>
          </div>
        </div>
        <Photo
          className="aspect-[4/5] overflow-hidden rounded-site shadow-[14px_14px_0_var(--color-violet)] max-[900px]:aspect-[4/3] max-[900px]:w-[calc(100%-8px)] max-[900px]:max-w-[520px] max-[900px]:justify-self-center max-[900px]:shadow-[8px_8px_0_var(--color-violet)]"
          name="melenchon"
          sizes="(max-width: 900px) 100vw, 480px"
          position="50% 30%"
        />
      </div>
    </section>
  );
}
