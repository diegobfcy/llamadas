// Convex API helpers — thin wrappers around the generated API.
// Assumes the Convex backend already has these mutations/queries defined.
// If the generated file doesn't exist yet, run `npx convex dev` to generate it.

import { api } from "@/convex/_generated/api";
import { ConvexReactClient } from "convex/react";

let _client: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient {
  if (!_client) {
    const url = process.env.EXPO_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("Missing EXPO_PUBLIC_CONVEX_URL");
    _client = new ConvexReactClient(url, { unsavedChangesWarning: false });
  }
  return _client;
}

// Re-export the generated API for convenience
export { api };
