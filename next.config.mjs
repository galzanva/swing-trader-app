
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
    serverComponentsExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
  },
};
export default nextConfig;
