// Convex schema reference — DO NOT MODIFY.
// This file documents the existing schema. The actual schema lives in the Convex deployment.
// The app uses these types for type-safety when calling queries/mutations.

import { Doc, Id } from "convex/_generated/dataModel";

// ── users ──
export type UserDoc = Doc<"users"> & {
  clerkId: string;
  displayName: string;
  lang: string;
  plan: "free" | "premium";
  secondsRemaining: number;
};
export type UserId = Id<"users">;

// ── calls ──
export type CallDoc = Doc<"calls"> & {
  ownerId: UserId;
  code: string; // internally: the callee's userId (or clerkId)
  status: "waiting" | "active" | "ended";
  startedAt?: number;
  endedAt?: number;
  secondsBilled?: number;
};
export type CallId = Id<"calls">;

// ── participants ──
export type ParticipantDoc = Doc<"participants"> & {
  callId: CallId;
  userId?: UserId;
  displayName: string;
  lang: string;
  isOwner: boolean;
  lastSeenAt: number;
};
export type ParticipantId = Id<"participants">;

// ── utterances ──
export type UtteranceDoc = Doc<"utterances"> & {
  callId: CallId;
  speakerId: ParticipantId;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText?: string;
  isFinal: boolean;
};
export type UtteranceId = Id<"utterances">;
