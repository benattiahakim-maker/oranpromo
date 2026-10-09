"use client";

// US-24.2 : petite carte de la position d'une boutique (épingle déplaçable du doigt).
// Leaflet touche `window` : ce fichier n'est chargé que par next/dynamic({ ssr: false }) depuis ChoixPosition et PositionEspace.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fondDeCarte } from "@/lib/carte";
import { CENTRE_ORAN, dansOran, type Position } from "@/lib/position";

export type ProprietesCartePosition = { position: Position | null; deplacable: boolean; onDeplacer?: (position: Position) => void; libelle: string };

const epingle = L.divIcon({ className: "", html: '<span style="display:block;width:22px;height:22px;background:#0A0A0A;border:2px solid #FFFFFF;outline:1px solid #0A0A0A"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

export default function CartePosition({ position, deplacable, onDeplacer, libelle }: ProprietesCartePosition) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const marqueur = useRef<L.Marker | null>(null);
  const rappel = useRef(onDeplacer);
  useEffect(() => { rappel.current = onDeplacer; }, [onDeplacer]);

  useEffect(() => {
    if (!conteneur.current) return;
    const fond = fondDeCarte(process.env.NEXT_PUBLIC_CARTO_CLE);
    const map = L.map(conteneur.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    map.attributionControl.setPrefix(false);
    L.tileLayer(fond.url, { attribution: fond.attribution, subdomains: fond.sousDomaines, maxZoom: fond.zoomMax, minZoom: 10 }).addTo(map);
    map.setView([CENTRE_ORAN.latitude, CENTRE_ORAN.longitude], 13);
    if (deplacable) map.on("click", (evenement: L.LeafletMouseEvent) => {
      const { lat, lng } = evenement.latlng;
      if (dansOran(lat, lng)) rappel.current?.({ latitude: lat, longitude: lng });
    });
    carte.current = map;
    return () => { map.remove(); carte.current = null; marqueur.current = null; };
  }, [deplacable]);

  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    if (!position) { marqueur.current?.remove(); marqueur.current = null; return; }
    const point: L.LatLngTuple = [position.latitude, position.longitude];
    if (!marqueur.current) {
      const nouveau = L.marker(point, { icon: epingle, draggable: deplacable, keyboard: false, title: libelle });
      nouveau.on("dragend", () => {
        const { lat, lng } = nouveau.getLatLng();
        rappel.current?.({ latitude: lat, longitude: lng });
      });
      marqueur.current = nouveau.addTo(map);
      map.setView(point, 17);
    } else {
      marqueur.current.setLatLng(point);
      if (!map.getBounds().contains(point)) map.setView(point, Math.max(map.getZoom(), 16));
    }
  }, [position, deplacable, libelle]);

  // La carte ne se retourne jamais (dir="ltr"), même si la page passe de droite à gauche.
  return <div ref={conteneur} dir="ltr" role="region" aria-label={libelle} className="relative z-0 h-[200px] w-full border border-trait bg-[#F2F2F2]" />;
}
