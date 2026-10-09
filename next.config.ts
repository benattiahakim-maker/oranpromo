import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le site local est ouvert sur http://127.0.0.1:3000 (lancer-site.bat) : autoriser cette origine en développement.
  allowedDevOrigins: ["127.0.0.1"],
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
