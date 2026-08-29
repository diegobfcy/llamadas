// Convex hooks for the calls app.
// These wrap the generated Convex API. The actual queries/mutations
// must exist in the Convex backend (already deployed).

import { api } from "@/lib/convex";
import type { Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";

// ── Users ──

export function useUserByClerkId(clerkId: string | undefined) {
  return useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
}

export function useAllUsers() {
  return useQuery(api.users.list, {});
}

export function useSearchUsers(query: string) {
  return useQuery(api.users.search, query ? { query } : "skip");
}

// ── Calls ──

export function useCallByCode(code: string | undefined) {
  return useQuery(api.calls.getByCode, code ? { code } : "skip");
}

export function useCallById(callId: Id<"calls"> | undefined) {
  return useQuery(api.calls.getById, callId ? { callId } : "skip");
}

export function useIncomingCall(myUserId: string | undefined) {
  // Listen for calls where code == myUserId and status == "waiting"
  return useQuery(
    api.calls.getIncoming,
    myUserId ? { userId: myUserId } : "skip",
  );
}

export function useCreateCall() {
  return useMutation(api.calls.create);
}

export function useUpdateCallStatus() {
  return useMutation(api.calls.updateStatus);
}

export function useEndCall() {
  return useMutation(api.calls.end);
}

// ── Participants ──

export function useParticipantsByCall(callId: Id<"calls"> | undefined) {
  return useQuery(api.participants.byCall, callId ? { callId } : "skip");
}

export function useJoinCall() {
  return useMutation(api.participants.join);
}

// ── Utterances ──

export function useUtterancesByCall(callId: Id<"calls"> | undefined) {
  return useQuery(api.utterances.byCall, callId ? { callId } : "skip");
}

export function useAddUtterance() {
  return useMutation(api.utterances.add);
}

// ── User management ──

export function useUpsertUser() {
  return useMutation(api.users.upsert);
}
