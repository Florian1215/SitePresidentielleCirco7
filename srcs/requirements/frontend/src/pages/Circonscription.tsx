import { useEffect, useMemo, useState } from 'react';
import { CircoMap } from '../components/CircoMap';
import type { MapLabels, MapPoint } from '../components/CircoMap';
import { Photo } from '../components/Photo';
import { api } from '../lib/api';
import { CAMPAIGN, COUNTRIES } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import type { ActionGroup } from '../lib/models';
import { usePageTitle } from '../lib/title';

const TOTAL = COUNTRIES.reduce((sum, p) => sum + (p.registered ?? 0), 0);

type GroupPoint = MapPoint & { group: ActionGroup };

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

  const points = useMemo<GroupPoint[]>(() => groups.map((g) => ({ ...g, href: g.url, group: g })), [groups]);

  const labels: MapLabels = {
    mapAria: t.mapAria,
    zoomIn: t.zoomIn,
    zoomOut: t.zoomOut,
    resetZoom: t.resetZoom,
    legendCirco: t.legendCirco,
    legendPoint: t.legendGroup,
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
          <div>
            <span className="eyebrow">{i18n.d.common.circo}</span>
            <h1>
              {i18n.f(t.titleA, { n: COUNTRIES.length })}
              <br />
              <span className="hl">{t.titleHl}</span>
            </h1>
            <p className="lead max-w-[600px]">{i18n.f(t.lead, { n: i18n.number(TOTAL) })}</p>
            <ul className="mx-0 mt-7 mb-0 flex list-none flex-wrap gap-3 p-0 [&_span]:text-[13px] [&_span]:font-bold [&_strong]:font-titre [&_strong]:text-[36px] [&_strong]:leading-none">
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
      <section className="section bg-gris-clair pb-0" id="carte">
        <div className="site-container">
          <div className="section-head mb-6">
            <span className="eyebrow">{t.mapEyebrow}</span>
            <h2>{t.mapTitle}</h2>
          </div>
        </div>

        {/* Carte en pleine largeur, avec le panneau des groupes posé dessus */}
        <CircoMap
          idPrefix="groupes"
          points={points}
          labels={labels}
          renderTooltip={(p) => (
            <>
              <strong>{p.name}</strong>
              <span>
                {p.group.city ? p.group.city + ' · ' : ''}
                {i18n.country(p.country)}
              </span>
              <em>{t.clickToJoin}</em>
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
    </div>
  );
}
