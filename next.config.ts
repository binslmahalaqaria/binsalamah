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
  // firebase-admin (used for Firestore admin access in app/api/staff)
  // bundles some native/CJS internals that are safer resolved natively by
  // Node at runtime than bundled by Turbopack. Note: firebase-admin/auth
  // is deliberately NOT used anywhere (see app/api/staff/route.ts) because
  // its jwt.js does a CJS require("jwks-rsa") -> require("jose"), and that
  // require-of-ESM interop crashes deployed Vercel functions with
  // ERR_REQUIRE_ESM even with this package externalized — the failure is
  // one level too deep for serverExternalPackages to help with in
  // Turbopack. The route uses `jose` directly instead (a plain ESM
  // import, not the broken CJS chain), which Turbopack bundles correctly.
  // The PDF route (app/api/pdf) runs a headless Chromium: both packages stay native,
  // and the compressed browser files are shipped with that function.
  serverExternalPackages: ["firebase-admin", "@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: { "/api/pdf": ["./node_modules/@sparticuz/chromium/bin/**"] },
};

export default withNextIntl(nextConfig);
