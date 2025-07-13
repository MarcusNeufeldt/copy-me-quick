/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'avatars.githubusercontent.com',
            port: '',
            pathname: '/u/**', // Allows any path starting with /u/
          },
        ],
      },
    webpack: (config, { isServer }) => {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
  
      // Ensure WebAssembly works properly for both client and server-side
      config.output.webassemblyModuleFilename = isServer
        ? './../static/wasm/[modulehash].wasm'
        : 'static/wasm/[modulehash].wasm';
  
      // Ensure WebAssembly files are outputted
      config.optimization.moduleIds = 'named';
  
      return config;
    },
  };
  
  module.exports = nextConfig;