"use client";

// US-24.3 : carte des boutiques (Leaflet). Chargée seulement par next/dynamic({ ssr: false }) depuis CarteBoutiques.
// La position de la cliente (« origine ») ne sert qu'à dessiner le point « Vous » et à recadrer : rien n'est envoyé.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fondDeCarte, ZOOM_MAX_AUTOUR, type BoutiqueCarte } from "@/lib/carte";
import type { Position } from "@/lib/position";
import { VILLE_ORAN, type Ville } from "@/lib/ville";

export type ProprietesCarteLeaflet = {
  boutiques: (BoutiqueCarte & Position)[];
  origine: Position | null;
  proches: Position[];
  selection: string | null;
  onSelection: (id: string | null) => void;
  onIndisponible: () => void;
  libelles: { region: string; vous: string; epingle: (boutique: BoutiqueCarte) => string };
  /** US-29.3 : bornes, centre et zoom de la ville (Oran par défaut, comme avant). */
  cadre?: Pick<Ville, "lat_min" | "lat_max" | "lng_min" | "lng_max" | "centre_lat" | "centre_lng" | "zoom">;
};

function icone(promos: number, choisie: boolean): L.DivIcon {
  const fond = choisie ? "#FFFFFF" : "#0A0A0A", texte = choisie ? "#0A0A0A" : "#FFFFFF";
  const taille = promos > 0 ? 28 : 18;
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${taille}px;height:${taille}px;background:${fond};color:${texte};border:2px solid #0A0A0A;outline:1px solid #FFFFFF;font:600 12px/1 Jost,sans-serif">${promos > 0 ? promos : ""}</span>`,
    iconSize: [taille, taille],
    iconAnchor: [taille / 2, taille / 2],
  });
}

export default function CarteLeaflet({ boutiques, origine, proches, selection, onSelection, onIndisponible, libelles, cadre = VILLE_ORAN }: ProprietesCarteLeaflet) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const calque = useRef<L.LayerGroup | null>(null);
  const point = useRef<L.CircleMarker | null>(null);
  const rappels = useRef({ onSelection, onIndisponible });
  useEffect(() => { rappels.current = { onSelection, onIndisponible }; }, [onSelection, onIndisponible]);

  useEffect(() => {
    if (!conteneur.current) return;
    const fond = fondDeCarte(process.env.NEXT_PUBLIC_CARTO_CLE);
    const map = L.map(conteneur.current, { scrollWheelZoom: false, maxBounds: L.latLngBounds([cadre.lat_min - 0.2, cadre.lng_min - 0.3], [cadre.lat_max + 0.2, cadre.lng_max + 0.3]) });
    map.attributionControl.setPrefix(false);
    let chargees = 0, erreurs = 0;
    L.tileLayer(fond.url, { attribution: fond.attribution, subdomains: fond.sousDomaines, maxZoom: fond.zoomMax, minZoom: 9 })
      .on("tileload", () => { chargees++; })
      .on("tileerror", () => { erreurs++; if (erreurs >= 4 && chargees === 0) rappels.current.onIndisponible(); })
      .addTo(map);
    map.setView([cadre.centre_lat, cadre.centre_lng], cadre.zoom);
    map.on("click", () => rappels.current.onSelection(null));
    calque.current = L.layerGroup().addTo(map);
    carte.current = map;
    return () => { map.remove(); carte.current = null; calque.current = null; point.current = null; };
  }, [cadre]);

  // Épingles (une par boutique placée du filtre), cadrées au départ sur toutes les épingles.
  const premierCadrage = useRef(true);
  useEffect(() => {
    const map = carte.current, groupe = calque.current;
    if (!map || !groupe) return;
    groupe.clearLayers();
    for (const boutique of boutiques) {
      L.marker([boutique.latitude, boutique.longitude], { icon: icone(boutique.promos, boutique.id === selection), title: libelles.epingle(boutique), alt: libelles.epingle(boutique), riseOnHover: true, zIndexOffset: boutique.id === selection ? 1000 : 0 })
        .on("click", evenement => { L.DomEvent.stopPropagation(evenement); rappels.current.onSelection(boutique.id); })
        .addTo(groupe);
    }
    if (premierCadrage.current && boutiques.length) {
      premierCadrage.current = false;
      if (boutiques.length === 1) map.setView([boutiques[0].latitude, boutiques[0].longitude], 15);
      else map.fitBounds(L.latLngBounds(boutiques.map(b => [b.latitude, b.longitude] as L.LatLngTuple)), { padding: [48, 48], maxZoom: 15 });
    }
  }, [boutiques, selection, libelles]);

  // Point « Vous » et recadrage sur la cliente et les boutiques les plus proches (zoom 15 au plus).
  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    point.current?.remove(); point.current = null;
    if (!origine) return;
    point.current = L.circleMarker([origine.latitude, origine.longitude], { radius: 7, color: "#FFFFFF", weight: 2, fillColor: "#0A0A0A", fillOpacity: 1 })
      .bindTooltip(libelles.vous, { permanent: true, direction: "right", offset: [8, 0] }).addTo(map);
    const cadre = L.latLngBounds([[origine.latitude, origine.longitude], ...proches.map(p => [p.latitude, p.longitude] as L.LatLngTuple)]);
    map.fitBounds(cadre, { padding: [32, 32], maxZoom: ZOOM_MAX_AUTOUR });
  }, [origine, proches, libelles]);

  // La carte ne se retourne jamais (dir="ltr"), même en arabe.
  return <div ref={conteneur} dir="ltr" role="region" aria-label={libelles.region} className="relative z-0 h-[340px] w-full border-y border-trait bg-[#F2F2F2]" />;
}
