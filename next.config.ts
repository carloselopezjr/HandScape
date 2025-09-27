import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // MediaPipe support configuration
  webpack: (config, { isServer }) => {
    // Handle WASM files for MediaPipe
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // Handle MediaPipe WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });
    
    // Don't try to run MediaPipe on the server
    if (isServer) {
      config.externals = [...(config.externals || []), '@mediapipe/hands'];
    }
    
    return config;
  },
};

export default nextConfig;
