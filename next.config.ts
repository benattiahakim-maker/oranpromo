import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tests de parcours (e2e/, Playwright) : construction à part dans .next-e2e, branchée sur la base Supabase locale,
  // pour ne jamais mélanger avec le site normal (.next). Voir docs/tests-parcours.md.
  ...(process.env.BLEDEAL_E2E === "1" ? { distDir: ".next-e2e" } : {}),
  // Le site local est ouvert sur http://127.0.0.1:3000 (lancer-site.bat) : autoriser cette origine en développement.
  allowedDevOrigins: ["127.0.0.1"],
  // Photos + miniatures compressées : 4 Mo au total maximum (TAILLE_ENVOI_PHOTOS_MAX dans lib/article.ts)
  // + marge du formulaire, sous la limite d'environ 4,5 Mo d'un envoi sur Vercel.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
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
