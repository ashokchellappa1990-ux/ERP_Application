/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the native MySQL driver & Prisma out of the bundler — they run
  // only in Node (route handlers / server components), never in the browser.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-mariadb", "mariadb"],
};

export default nextConfig;
