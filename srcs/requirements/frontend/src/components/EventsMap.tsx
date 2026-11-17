import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useI18n } from '../lib/i18n';
import type { CampaignEvent } from '../lib/models';

/** Rendez-vous localisés, regroupés par adresse (plusieurs rendez-vous au même endroit = un seul repère). */
interface Place {
  key: string;
  lat: number;
  lng: number;
  events: CampaignEvent[];
}

/** Repère aux couleurs du site (pas d'image : l'icône par défaut de Leaflet se charge mal avec Vite). */
const pin = (n: number, active: boolean) =>
  L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
    html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:3px solid ${active ? 'var(--color-noir)' : '#fff'};background:${active ? 'var(--color-jaune)' : 'var(--color-rouge)'};color:${active ? 'var(--color-noir)' : '#fff'};font:700 13px var(--font-texte);box-shadow:0 2px 8px rgba(0,0,0,.35)">${n > 1 ? n : ''}</span>`,
  });

/** Zoom quand on choisit un rendez-vous : assez près pour lire la rue. */
const STREET_ZOOM = 17;

interface Props {
  events: CampaignEvent[];
}

/** Carte OpenStreetMap des rendez-vous : vue d'ensemble, puis zoom jusqu'à l'adresse. */
export default function EventsMap({ events }: Props) {
  const i18n = useI18n();
  const t = i18n.d.blog;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const [active, setActive] = useState<string | null>(null);

  const places = useMemo<Place[]>(() => {
    const byKey = new Map<string, Place>();
    for (const e of events) {
      if (e.latitude === null || e.longitude === null) continue;
      const key = `${e.latitude.toFixed(5)},${e.longitude.toFixed(5)}`;
      const place = byKey.get(key) ?? { key, lat: e.latitude, lng: e.longitude, events: [] };
      place.events.push(e);
      byKey.set(key, place);
    }
    return [...byKey.values()];
  }, [events]);

  const when = (e: CampaignEvent) => {
    const s = i18n.date(e.start, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  /** Contenu de la bulle, construit en DOM (textContent : pas d'injection de HTML venu du calendrier). */
  const popup = (place: Place) => {
    const root = document.createElement('div');
    root.className = 'grid gap-3 font-texte';
    for (const e of place.events) {
      const item = document.createElement('div');
      const title = document.createElement('strong');
      title.className = 'block font-titre text-[18px] leading-tight text-violet';
      title.textContent = e.title;
      const date = document.createElement('span');
      date.className = 'mt-1 block text-[13px] font-bold text-noir';
      date.textContent = when(e);
      item.append(title, date);
      if (e.location) {
        const loc = document.createElement('span');
        loc.className = 'block text-[13px] text-texte';
        loc.textContent = e.location;
        item.append(loc);
      }
      if (e.url) {
        const a = document.createElement('a');
        a.href = e.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'mt-1.5 inline-block text-[13px] font-bold text-rouge! hover:text-rouge-dark!';
        a.textContent = t.eventSignup;
        item.append(a);
      }
      root.append(item);
    }
    return root;
  };

  // Création de la carte (une fois)
  useEffect(() => {
    const m = L.map(box.current!, { scrollWheelZoom: false, zoomSnap: 0.5 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(m);
    // La molette ne zoome qu'après un clic sur la carte, pour ne pas bloquer le défilement de la page
    m.on('click focus', () => m.scrollWheelZoom.enable());
    m.on('mouseout blur', () => m.scrollWheelZoom.disable());
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Repères, et vue d'ensemble sur tous les rendez-vous
  useEffect(() => {
    const m = map.current!;
    const layer = L.layerGroup().addTo(m);
    markers.current.clear();
    for (const p of places) {
      const marker = L.marker([p.lat, p.lng], { icon: pin(p.events.length, false), title: p.events[0].title, keyboard: true })
        .bindPopup(() => popup(p), { maxWidth: 280, minWidth: 220 })
        .on('popupopen', () => setActive(p.key))
        .on('popupclose', () => setActive((k) => (k === p.key ? null : k)))
        .addTo(layer);
      markers.current.set(p.key, marker);
    }
    if (places.length) m.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 13 });
    else m.setView([50, 15], 4);
    return () => {
      layer.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, i18n]);

  // Repère choisi : en jaune
  useEffect(() => {
    for (const p of places) markers.current.get(p.key)?.setIcon(pin(p.events.length, p.key === active));
  }, [active, places]);

  const focus = (p: Place) => {
    const m = map.current!;
    m.flyTo([p.lat, p.lng], STREET_ZOOM, { duration: 0.8 });
    m.once('moveend', () => markers.current.get(p.key)?.openPopup());
    box.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const showAll = () => {
    map.current?.closePopup();
    if (places.length)
      map.current?.flyToBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 13, duration: 0.8 });
  };

  return (
    <div className="grid grid-cols-[1fr_320px] gap-5 max-[900px]:grid-cols-1">
      <div
        ref={box}
        className="z-0 h-[clamp(420px,65vh,640px)] overflow-hidden rounded-site shadow-site max-[900px]:h-[420px]"
        role="region"
        aria-label={t.eventsMapAria}
      />
      <aside className="flex max-h-[clamp(420px,65vh,640px)] flex-col rounded-site bg-white p-4 shadow-site max-[900px]:max-h-none">
        <button type="button" className="btn btn-sm btn-outline mb-3 self-start" onClick={showAll} disabled={!places.length}>
          {t.eventsShowAll}
        </button>
        {places.length ? (
          <ul className="-mx-1 m-0 grid list-none gap-1 overflow-y-auto p-0">
            {places.flatMap((p) =>
              p.events.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => focus(p)}
                    className={`w-full cursor-pointer rounded-md border-0 px-2 py-2 text-left [font-family:inherit] hover:bg-lavande ${active === p.key ? 'bg-lavande' : 'bg-transparent'}`}
                  >
                    <span className="block text-[15px] font-bold text-violet">{e.title}</span>
                    <span className="block text-[13px] text-texte">
                      {when(e)}
                      {e.city ? ` · ${i18n.city(e.city)}` : ''}
                    </span>
                  </button>
                </li>
              )),
            )}
          </ul>
        ) : (
          <p className="muted m-0 text-[14px]">{t.eventsMapEmpty}</p>
        )}
      </aside>
    </div>
  );
}
