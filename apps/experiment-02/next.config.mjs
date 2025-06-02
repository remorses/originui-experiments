/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: "/exp2-static",
  transpilePackages: ["@workspace/ui"],
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
  },
}

export default nextConfig
