// Environment variables — create a .env file with these values.
// EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
// EXPO_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
// EXPO_PUBLIC_SINCRO_DISPATCHER_URL=https://sincro-dispatcher...
// EXPO_PUBLIC_SINCRO_WORKER_URL=wss://sincro-worker...

export const ENV = {
  CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL!,
  SINCRO_DISPATCHER_URL: process.env.EXPO_PUBLIC_SINCRO_DISPATCHER_URL!,
  SINCRO_WORKER_URL: process.env.EXPO_PUBLIC_SINCRO_WORKER_URL!,
} as const;
