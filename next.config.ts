import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  // Configure webpack to handle canvas properly (server-side only)
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't externalize canvas - we need it bundled for server actions
      // But mark it as a server-only module
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    } else {
      // Exclude canvas from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
  // Ensure these packages are treated as server-only
  serverExternalPackages: ['pdf-img-convert'],
};

export default nextConfig;
