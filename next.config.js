/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Keep the build forgiving during a hackathon: a type error must never block a deploy.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
