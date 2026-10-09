"use client";

import { useEffect, useRef } from "react";
import { enregistrerEvenement } from "@/lib/evenements";

export default function EnregistrerVue({ boutiqueId, articleId }: { boutiqueId: string; articleId?: string }) {
  const derniereVue = useRef<string | null>(null);
  useEffect(() => {
    const cle = `${boutiqueId}/${articleId ?? "boutique"}`;
    if (derniereVue.current === cle) return;
    derniereVue.current = cle;
    void enregistrerEvenement(articleId ? "vue_article" : "vue_boutique", boutiqueId, articleId);
  }, [boutiqueId, articleId]);
  return null;
}
