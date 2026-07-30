/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No .eslintrc/eslint.config exists in this repo — Next's build was still
  // running its bundled default lint ruleset as part of the combined
  // "Linting and checking validity of types" build step, adding real memory
  // pressure for no actual enforced rule set. `npm run lint` stays available
  // to run by hand; this only skips the redundant pass during `next build`.
  eslint: { ignoreDuringBuilds: true },
  // Keep native/heavy Node-only packages out of the webpack bundle — they run
  // only in Node (route handlers / server components), never in the browser.
  // This project is on Next.js 14, where this option is still under
  // `experimental` (it only became a stable top-level `serverExternalPackages`
  // key in Next.js 15 — using the top-level key on 14 just silently no-ops
  // with a config warning, which is what was happening here).
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb", "pdf-parse", "pdfjs-dist"],
  },
};

export default nextConfig;
