import { useEffect, useMemo, useState } from 'react';
import { CircoMap } from '../components/CircoMap';
import type { MapLabels, MapPoint } from '../components/CircoMap';
import { Photo } from '../components/Photo';
import { api } from '../lib/api';
import { CAMPAIGN, COUNTRIES } from '../lib/campaign';
import { useI18n } from '../lib/i18n';
import type { ActionGroup } from '../lib/models';
import { usePageTitle } from '../lib/title';
import './Circonscription.scss';

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
    <div className="page-circo">
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">{i18n.d.common.circo}</span>
            <h1>
              {i18n.f(t.titleA, { n: COUNTRIES.length })}
              <br />
              <span className="hl">{t.titleHl}</span>
            </h1>
            <p className="lead">{i18n.f(t.lead, { n: i18n.number(TOTAL) })}</p>
            <ul className="stats">
              <li>
                <strong>{COUNTRIES.length}</strong>
                <span>{t.countries}</span>
              </li>
              <li>
                <strong>{i18n.number(TOTAL)}</strong>
                <span>{t.registered}</span>
              </li>
              {groups.length > 0 && (
                <li>
                  <strong>{groups.length}</strong>
                  <span>{t.groups}</span>
                </li>
              )}
            </ul>
          </div>
          <Photo
            className="hero-photo"
            name="manifBerlin"
            sizes="(max-width: 900px) 100vw, 480px"
            caption={t.photoCaption}
            position="60% 50%"
            eager
          />
        </div>
      </section>

      {/* CARTE */}
      <section className="section map-section" id="carte">
        <div className="container">
          <div className="section-head map-head">
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
