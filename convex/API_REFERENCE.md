// Convex backend API reference.
// These are the queries and mutations that MUST exist in the Convex deployment.
// The app expects these exact function signatures.
// DO NOT create these — they already exist in the deployed Convex backend.

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
users.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get user by clerkId
export const getByClerkId = query({
args: { clerkId: v.string() },
handler: async (ctx, args) => {
return await ctx.db
.query("users")
.withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
.first();
},
});

// List all users
export const list = query({
args: {},
handler: async (ctx) => {
return await ctx.db.query("users").collect();
},
});

// Search users by displayName
export const search = query({
args: { query: v.string() },
handler: async (ctx, args) => {
return await ctx.db
.query("users")
.withSearchIndex("by_name", (q) => q.search("displayName", args.query))
.collect();
},
});

// Upsert user (create or update)
export const upsert = mutation({
args: {
clerkId: v.string(),
displayName: v.string(),
lang: v.string(),
},
handler: async (ctx, args) => {
const existing = await ctx.db
.query("users")
.withIndex("by_clerk", (q) => q.eq("clerkId", args.clerkId))
.first();
if (existing) {
await ctx.db.patch(existing._id, {
displayName: args.displayName,
lang: args.lang,
});
return existing._id;
}
return await ctx.db.insert("users", {
clerkId: args.clerkId,
displayName: args.displayName,
lang: args.lang,
plan: "free",
secondsRemaining: 3600, // 1 hour free
});
},
});

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
calls.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get call by code
export const getByCode = query({
args: { code: v.string() },
handler: async (ctx, args) => {
return await ctx.db
.query("calls")
.withIndex("by_code", (q) => q.eq("code", args.code))
.first();
},
});

// Get call by ID
export const getById = query({
args: { callId: v.id("calls") },
handler: async (ctx, args) => {
return await ctx.db.get(args.callId);
},
});

// Get incoming calls (where code == my userId and status == "waiting")
export const getIncoming = query({
args: { userId: v.string() },
handler: async (ctx, args) => {
return await ctx.db
.query("calls")
.withIndex("by_code", (q) => q.eq("code", args.userId))
.filter((q) => q.eq(q.field("status"), "waiting"))
.collect();
},
});

// Create a new call
export const create = mutation({
args: {
ownerId: v.id("users"),
code: v.string(),
},
handler: async (ctx, args) => {
return await ctx.db.insert("calls", {
ownerId: args.ownerId,
code: args.code,
status: "waiting",
});
},
});

// Update call status
export const updateStatus = mutation({
args: {
callId: v.id("calls"),
status: v.union(v.literal("active"), v.literal("ended")),
},
handler: async (ctx, args) => {
const patch: any = { status: args.status };
if (args.status === "active") {
patch.startedAt = Date.now();
}
await ctx.db.patch(args.callId, patch);
},
});

// End call and calculate billing
export const end = mutation({
args: { callId: v.id("calls") },
handler: async (ctx, args) => {
const call = await ctx.db.get(args.callId);
if (!call || call.status === "ended") return;

    const endedAt = Date.now();
    const startedAt = call.startedAt ?? endedAt;
    const secondsBilled = Math.ceil((endedAt - startedAt) / 1000);

    await ctx.db.patch(args.callId, {
      status: "ended",
      endedAt,
      secondsBilled,
    });

    // Deduct from owner's secondsRemaining
    const owner = await ctx.db.get(call.ownerId);
    if (owner) {
      const newRemaining = Math.max(0, owner.secondsRemaining - secondsBilled);
      await ctx.db.patch(call.ownerId, { secondsRemaining: newRemaining });
    }

},
});

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
participants.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get participants by call
export const byCall = query({
args: { callId: v.id("calls") },
handler: async (ctx, args) => {
return await ctx.db
.query("participants")
.withIndex("by_call", (q) => q.eq("callId", args.callId))
.collect();
},
});

// Join a call
export const join = mutation({
args: {
callId: v.id("calls"),
userId: v.optional(v.id("users")),
displayName: v.string(),
lang: v.string(),
isOwner: v.boolean(),
},
handler: async (ctx, args) => {
return await ctx.db.insert("participants", {
callId: args.callId,
userId: args.userId,
displayName: args.displayName,
lang: args.lang,
isOwner: args.isOwner,
lastSeenAt: Date.now(),
});
},
});

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
utterances.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Get utterances by call
export const byCall = query({
args: { callId: v.id("calls") },
handler: async (ctx, args) => {
return await ctx.db
.query("utterances")
.withIndex("by_call", (q) => q.eq("callId", args.callId))
.order("desc")
.collect();
},
});

// Add an utterance
export const add = mutation({
args: {
callId: v.id("calls"),
speakerId: v.id("participants"),
sourceLang: v.string(),
targetLang: v.string(),
sourceText: v.string(),
translatedText: v.optional(v.string()),
isFinal: v.boolean(),
},
handler: async (ctx, args) => {
return await ctx.db.insert("utterances", args);
},
});
*/
