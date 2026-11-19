import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // schlankes Docker-Image
  async headers() {
    return [
      // Das Einbettungsskript darf von jeder Webseite geladen werden
      { source: "/embed.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }] },
      // Nur die Einbettungsseiten dürfen in fremde Seiten eingebettet werden, alles andere nicht
      { source: "/embed/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      {
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
