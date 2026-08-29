import { getConvexClient } from "@/lib/convex";
import { ENV } from "@/lib/env";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";

const convex = getConvexClient();

if (!ENV.CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env");
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={ENV.CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <ConvexProvider client={convex}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="call/[id]" options={{ presentation: "modal" }} />
        </Stack>
      </ConvexProvider>
    </ClerkProvider>
  );
}
