import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local development only: lets the app also be opened at http://127.0.0.1:3000
  // (used for testing with a second login). Has no effect on the live site.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
