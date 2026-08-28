/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // stellar-sdk / wallets-kit rely on Node-style globals not present in
    // the browser bundle target; polyfill minimally rather than disabling
    // strictness project-wide.
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};

module.exports = nextConfig;
