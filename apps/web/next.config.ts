import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  experimental: { proxyTimeout: 400000 },
  async rewrites() {
    return [{ source: '/api/ai/:path*', destination: `${process.env.TAIJI_API_URL || 'http://127.0.0.1:8000'}/api/ai/:path*` }];
  },
  async headers() {
    return [{ source: '/runtime/:path*', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }, { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' }] }];
  },
};
export default nextConfig;
