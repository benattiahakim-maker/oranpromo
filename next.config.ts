import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le site local est ouvert sur http://127.0.0.1:3000 (lancer-site.bat) : autoriser cette origine en développement.
  allowedDevOrigins: ["127.0.0.1"],
  // Photos compressées : 12 Mo au total maximum (TAILLE_ENVOI_PHOTOS_MAX dans lib/article.ts) + marge du formulaire.
  // Attention : certains hébergeurs plafonnent le corps des requêtes plus bas (Vercel : environ 4,5 Mo).
  experimental: { serverActions: { bodySizeLimit: "13mb" } },
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'https',
        hostname: 'iloyliuzsflzbkhpvxjt.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
