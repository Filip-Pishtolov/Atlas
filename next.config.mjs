const nextConfig = {
  serverExternalPackages: ['node:sqlite'],
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.loca.lt'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
};
export default nextConfig;
