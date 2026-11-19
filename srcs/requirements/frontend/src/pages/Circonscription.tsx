import { useEffect, useMemo, useState } from 'react';
import { ArticleCard } from '../components/ArticleCard';
import { CircoMap } from '../components/CircoMap';
import type { MapLabels, MapPoint } from '../components/CircoMap';
import { Photo } from '../components/Photo';
import { ELUS } from '../data/elus';
import { api } from '../lib/api';
import { CAMPAIGN, COUNTRIES } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import { FOOTER_ICONS } from '../components/footer-icons';
import { networkColor, networkName } from '../lib/networks';
import type { ActionGroup, Article } from '../lib/models';
import { usePageTitle } from '../lib/title';

/** Catégorie d'articles affichée en bas de page (slug de la catégorie « Actions des élus »). */
const ELUS_CATEGORY = 'actions-des-elus';

const TOTAL = COUNTRIES.reduce((sum, p) => sum + (p.registered ?? 0), 0);

type GroupPoint = MapPoint & { group: ActionGroup };

/** Icônes des réseaux sociaux d'un groupe d'action (liste du panneau et bulle de la carte). */
function SocialLinks({ group, className, tabIndex }: { group: ActionGroup; className: string; tabIndex?: number }) {
  return group.links.map((link) => {
    const icon = FOOTER_ICONS[link.network] ?? FOOTER_ICONS['other'];
    return (
      <a
        key={link.url}
        href={link.url}
        target="_blank"
        rel="noopener"
        tabIndex={tabIndex}
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full no-underline ${className}`}
        aria-label={`${group.name} — ${networkName(link.network)}`}
        title={networkName(link.network)}
      >
        <svg className="h-3.5 w-3.5 fill-current" viewBox={icon.viewBox} aria-hidden="true" focusable="false">
          <path d={icon.d} />
        </svg>
      </a>
    );
  });
}

export default function Circonscription() {
  usePageTitle('circonscription');
  const i18n = useI18n();
  const t = i18n.d.circo;

  const [groups, setGroups] = useState<ActionGroup[]>([]);
  useEffect(() => {
    let alive = true;
    api.actionGroups().then(
      (g) => alive && setGroups(g),
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  // Articles publiés de la catégorie « Actions des élus » (les 3 plus récents)
  const [elusArticles, setElusArticles] = useState<Article[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    api.articles({ category: ELUS_CATEGORY }, ctrl.signal).then(
      (res) => setElusArticles(res.results.filter((a) => a.status === 'published').slice(0, 3)),
      () => {},
    );
    return () => ctrl.abort();
  }, []);

  const points = useMemo<GroupPoint[]>(() => groups.map((g) => ({ ...g, href: g.url, group: g })), [groups]);

  const labels: MapLabels = {
    mapAria: t.mapAria,
    zoomIn: t.zoomIn,
    zoomOut: t.zoomOut,
    resetZoom: t.resetZoom,
    registeredN: t.registeredN,
    pointOne: t.groupOne,
    pointMany: t.groupMany,
    listAria: t.listAria,
    listEmpty: t.listUnavailable,
    pointAria: t.openOnAP,
  };

  return (
    <div>
      {/* HERO */}
      <section className="pt-[clamp(40px,7vw,88px)] pb-[clamp(40px,6vw,72px)]">
        <div className="site-container grid grid-cols-[1.3fr_1fr] items-center gap-12 max-[960px]:grid-cols-1">
          <div className="hero-copy">
            <span className="eyebrow">{i18n.d.common.circo}</span>
            <h1>
              {i18n.f(t.titleA, { n: COUNTRIES.length })}
              <br />
              <span className="hl">{t.titleHl}</span>
            </h1>
            <p className="lead max-w-[600px]">{i18n.f(t.lead, { n: i18n.number(TOTAL) })}</p>
            <ul className="hero-chips mx-0 mt-7 mb-0 flex list-none flex-wrap gap-3 p-0 [&_span]:text-[13px] [&_span]:font-bold [&_strong]:font-titre [&_strong]:text-[36px] [&_strong]:leading-none">
              <li className="flex flex-col rounded-site px-[18px] py-3 bg-lavande text-violet">
                <strong>{COUNTRIES.length}</strong>
                <span>{t.countries}</span>
              </li>
              <li className="flex flex-col rounded-site px-[18px] py-3 bg-rose text-rouge-dark">
                <strong>{i18n.number(TOTAL)}</strong>
                <span>{t.registered}</span>
              </li>
              {groups.length > 0 && (
                <li className="flex flex-col rounded-site px-[18px] py-3 bg-jaune text-noir">
                  <strong>{groups.length}</strong>
                  <span>{t.groups}</span>
                </li>
              )}
            </ul>
          </div>
          <Photo
            className="aspect-[4/3] overflow-hidden rounded-site"
            name="manifBerlin"
            sizes="(max-width: 900px) 100vw, 480px"
            caption={t.photoCaption}
            position="60% 50%"
            eager
          />
        </div>
      </section>

      {/* CARTE */}
      <section className="bg-gris-clair max-[960px]:pt-8" id="carte">
        {/* Carte en pleine largeur, avec le panneau des groupes posé dessus */}
        <CircoMap
          idPrefix="groupes"
          title={
            <>
              <span className="eyebrow">{t.mapEyebrow}</span>
              <h2 className="m-0 text-[clamp(26px,3vw,40px)]">{t.mapTitle}</h2>
            </>
          }
          points={points}
          labels={labels}
          interactiveTooltip
          renderItemExtra={(p) =>
            p.group.links.length > 0 && (
              <span className="flex shrink-0 gap-1">
                <SocialLinks group={p.group} className="text-violet hover:bg-violet hover:text-creme" />
              </span>
            )
          }
          renderTooltip={(p) => (
            <>
              <strong>{p.name}</strong>
              <span>
                {p.group.city ? p.group.city + ' · ' : ''}
                {i18n.country(p.country)}
              </span>
              {/* La bulle est cliquable : lien Action populaire et réseaux sociaux du groupe */}
              <div className="mt-2.5 flex flex-col items-stretch gap-1.5">
                {p.group.links.map((link) => {
                  const icon = FOOTER_ICONS[link.network] ?? FOOTER_ICONS['other'];
                  return (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener"
                      tabIndex={-1}
                      style={{ background: networkColor(link.network) }}
                      className="flex w-full items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-bold text-white no-underline hover:text-white hover:brightness-110"
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0 fill-current"
                        viewBox={icon.viewBox}
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d={icon.d} />
                      </svg>
                      {i18n.f(t.followOn, { network: networkName(link.network) })}
                    </a>
                  );
                })}
                <a
                  href={p.group.url}
                  target="_blank"
                  rel="noopener"
                  tabIndex={-1}
                  className="w-full rounded-full bg-jaune px-3 py-1.5 text-center text-[13px] font-bold text-noir no-underline hover:bg-white hover:text-noir"
                >
                  {t.joinOnAp}
                </a>
              </div>
            </>
          )}
          panelFooter={
            <>
              <p>
                <strong>{t.noGroupQ}</strong> {t.noGroupText}
              </p>
              <a href={CAMPAIGN.links.actionPopulaire} target="_blank" rel="noopener" className="btn btn-rouge btn-sm">
                {t.createGroup}
              </a>
            </>
          }
        />
      </section>

      {/* NOS ÉLU·ES */}
      <section className="section-sm" id="elus">
        <div className="site-container">
          <div className="section-head">
            <span className="eyebrow">{t.elusEyebrow}</span>
            <h2>{t.elusTitle}</h2>
          </div>

          <ul
            className="m-0 grid list-none grid-cols-3 gap-5 p-0 max-[760px]:grid-cols-2 max-[440px]:grid-cols-1"
            aria-label={t.elusListAria}
          >
            {ELUS.map((e, i) => (
              <li key={e.name} className="flex flex-col items-center rounded-site bg-white px-4 py-6 text-center shadow-site">
                {e.photo ? (
                  <img
                    className="h-36 w-36 rounded-full bg-lavande object-cover"
                    src={`/img/web/elus/${e.photo}.webp`}
                    alt=""
                    width={144}
                    height={144}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  // Pas encore de portrait : les initiales, sur l'une des couleurs du site
                  <span
                    className={`grid h-36 w-36 place-items-center rounded-full font-titre text-[48px] ${['bg-lavande text-violet', 'bg-rose text-rouge', 'bg-jaune text-noir'][i % 3]}`}
                    aria-hidden="true"
                  >
                    {e.name
                      .split(/[\s-]+/)
                      .filter((w) => /^\p{Lu}/u.test(w))
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')}
                  </span>
                )}
                <h3 className="mt-4 mb-1 text-[20px]">{e.name}</h3>
                <span className="text-[14px] text-texte">{t.elusZones[e.zone]}</span>
                {e.afe && (
                  <span className="mt-3 rounded-full bg-rose px-3 py-1 text-[12px] font-bold text-rouge-dark">{t.elusAfe}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="muted mt-5 text-center text-[14px]">
            {t.elusRole} · {t.elusSource}
          </p>

          {/* Leur action */}
          <div className="mt-[clamp(32px,5vw,56px)] grid grid-cols-[1fr_1.3fr] items-center gap-12 max-[900px]:grid-cols-1">
            <Photo
              className="aspect-[3/4] overflow-hidden rounded-site max-[900px]:aspect-[4/3]"
              name="elusAfe"
              sizes="(max-width: 900px) 100vw, 440px"
              position="50% 40%"
            />
            <div>
              <span className="eyebrow">{t.actionEyebrow}</span>
              <h3 className="mt-1 mb-4 text-[clamp(26px,3vw,36px)]">{t.actionTitle}</h3>
              <p className="text-noir">{t.actionText}</p>
              <Photo
                className="my-6 aspect-[16/9] overflow-hidden rounded-site"
                name="permanenceSociale"
                sizes="(max-width: 900px) 100vw, 600px"
              />
              <p className="mb-2 font-bold">{t.actionContact}</p>
              <ul className="m-0 grid list-none gap-1 p-0">
                {ELUS.filter((e) => e.email).map((e) => (
                  <li key={e.email}>
                    {e.name} — <a href={`mailto:${e.email}`}>{e.email}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ARTICLES « ACTIONS DES ÉLUS » */}
      {elusArticles.length > 0 && (
        <section className="section-sm bg-gris-clair" id="actions-des-elus">
          <div className="site-container">
            <div className="grid grid-3">
              {elusArticles.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
