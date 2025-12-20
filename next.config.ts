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
  // Increase server action body size limit to handle large multi-page PDF images
  serverActions: {
    bodySizeLimit: '50mb', // Increased from default 1mb to handle combined multi-page images
  },
  // Configure webpack to handle canvas properly (server-side only)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude canvas from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }
    return config;
  },
  // Turbopack configuration (stable in Next.js 15)
  turbopack: {
    resolveAlias: {
      // Map canvas to an empty module for client-side
      canvas: './empty-module.js',
    },
  },
  // Ensure these packages are treated as server-only
  serverExternalPackages: ['pdf-img-convert', 'canvas'],
};

export default nextConfig;
