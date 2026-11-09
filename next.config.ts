import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: '.next',
  images: {
    // BrandLogo is rendered at 59px in the header and 141px on auth screens.
    // These candidates preserve a sharp 3x source on Retina displays without
    // forcing a 640px derivative onto mobile clients.
    imageSizes: [64, 128, 192, 256, 384, 480],
  },
};

export default nextConfig;
