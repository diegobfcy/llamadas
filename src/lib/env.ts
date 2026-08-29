// Environment variables — create a .env file with these values.
// EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
// EXPO_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
// EXPO_PUBLIC_TRANSLATION_WS_URL=wss://your-azure-host

export const ENV = {
  CLERK_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!,
  CONVEX_URL: process.env.EXPO_PUBLIC_CONVEX_URL!,
  TRANSLATION_WS_URL: process.env.EXPO_PUBLIC_TRANSLATION_WS_URL!,
} as const;
