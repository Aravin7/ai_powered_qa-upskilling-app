import type { NextConfig } from 'next';
const config: NextConfig = {
  distDir: process.env.E2E_DIST_DIR === '.next-e2e' ? '.next-e2e' : '.next',
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
  outputFileTracingIncludes: {'/api/*':['./scripts/pdf-worker.cjs','./node_modules/pdf-parse/**/*','./node_modules/pdfjs-dist/**/*','./node_modules/@napi-rs/canvas*/**/*']},
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cache-Control', value: 'no-store' }
    ] }];
  }
};
export default config;
