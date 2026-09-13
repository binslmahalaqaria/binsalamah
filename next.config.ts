import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
  // firebase-admin's jwt.js does a CJS require("jwks-rsa"), which itself
  // requires the ESM-only `jose` package. Turbopack's production bundler
  // trips over that interop (works fine in `next dev`, breaks in the
  // deployed serverless function with ERR_REQUIRE_ESM). Externalizing
  // just "firebase-admin" wasn't enough — the failure is one level
  // deeper, in jwks-rsa/jose themselves — so all three need to be
  // excluded from bundling so Node resolves them natively at runtime.
  // See app/api/staff/route.ts, the only place that imports firebase-admin.
  serverExternalPackages: ["firebase-admin", "jwks-rsa", "jose"],
};

export default withNextIntl(nextConfig);
