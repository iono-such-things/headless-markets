/** @type {import('next').NextConfig} */
const nextConfig = {
  // Scaffolding template - expand with production optimizations
  reactStrictMode: true,
  
  // Enable SWC minification
  swcMinify: true,
  
  // Image optimization
  images: {
    domains: [
      // TODO: Add allowed image domains
    ],
  },
  
  // Webpack configuration for Web3 libraries
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    return config
  },
  
  // Environment variables
  env: {
    // TODO: Add public environment variables if needed
  },
  
  // TODO: Add redirects, rewrites, headers as needed
}

module.exports = nextConfig
