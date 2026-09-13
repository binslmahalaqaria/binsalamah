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
  // firebase-admin pulls in jwks-rsa, which does a CJS require() of the
  // ESM-only `jose` package. Turbopack's production bundler trips over
  // that interop (works fine in `next dev`, breaks in the deployed
  // serverless function with ERR_REQUIRE_ESM). Excluding it from
  // bundling makes Node resolve it natively at runtime instead, which
  // works. See app/api/staff/route.ts, the only place that imports it.
  serverExternalPackages: ["firebase-admin"],
};

export default withNextIntl(nextConfig);
