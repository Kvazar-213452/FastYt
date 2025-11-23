/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  assetPrefix: '/', // щоб шляхи до _next завжди були від кореня
  basePath: '',      // або не вказувати, щоб не додавати /main/chat
};
module.exports = nextConfig;

