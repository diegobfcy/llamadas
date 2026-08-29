import {
  useAllUsers,
  useCreateCall,
  useIncomingCall,
  useJoinCall,
  useSearchUsers,
  useUpdateCallStatus,
  useUpsertUser,
  useUserByClerkId
} from "@/hooks/useConvex";
import { useAuth, useUser } from "@clerk/expo";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import type { Id } from "convex/_generated/dataModel";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { startHostedAuth } = useHostedAuth();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <LoginScreen onSignIn={() => startHostedAuth({ mode: "sign-in" })} />
    );
  }

  return <MainScreen user={user!} router={router} />;
}

// ── Login Screen ──

function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <SafeAreaView style={styles.centered}>
      <Text style={styles.title}>Llamadas</Text>
      <Text style={styles.subtitle}>Real-time voice translation</Text>
      <View style={{ marginTop: 40 }}>
        <Button title="Sign In with Clerk" onPress={onSignIn} />
      </View>
    </SafeAreaView>
  );
}

// ── Main Screen (User List + Incoming Call Detection) ──

function MainScreen({
  user,
  router,
}: {
  user: ReturnType<typeof useUser>["user"];
  router: ReturnType<typeof useRouter>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLang, setSelectedLang] = useState("es");

  const clerkId = user?.id;
  const myUser = useUserByClerkId(clerkId);
  const upsertUser = useUpsertUser();
  const createCall = useCreateCall();
  const updateCallStatus = useUpdateCallStatus();
  const joinCall = useJoinCall();

  // Upsert user on first login
  useEffect(() => {
    if (clerkId && user) {
      upsertUser({
        clerkId,
        displayName:
          user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Unknown",
        lang: selectedLang,
      }).catch(console.error);
    }
  }, [clerkId]);

  // Search users
  const allUsers = useAllUsers();
  const searchResults = useSearchUsers(searchQuery);
  const displayedUsers = searchQuery ? searchResults : allUsers;

  // Filter out myself
  const filteredUsers =
    displayedUsers?.filter((u: any) => u.clerkId !== clerkId) ?? [];

  // Incoming call detection
  const myUserId = myUser?._id;
  const incomingCall = useIncomingCall(myUserId as string | undefined);

  useEffect(() => {
    if (incomingCall && incomingCall.length > 0) {
      const call = incomingCall[0];
      // Show incoming call alert
      Alert.alert("Incoming Call", `Call from user ${call.ownerId}`, [
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            await updateCallStatus({ callId: call._id, status: "ended" });
          },
        },
        {
          text: "Accept",
          onPress: async () => {
            await joinCall({
              callId: call._id,
              userId: myUserId as Id<"users">,
              displayName: user?.fullName ?? "Me",
              lang: selectedLang,
              isOwner: false,
            });
            await updateCallStatus({ callId: call._id, status: "active" });
            router.push(`/call/${call._id}`);
          },
        },
      ]);
    }
  }, [incomingCall]);

  const handleCallUser = useCallback(
    async (targetUser: any) => {
      if (!myUserId) return;
      try {
        // code = target user's id (internal routing)
        const callId = await createCall({
          ownerId: myUserId as Id<"users">,
          code: targetUser._id,
        });
        // Join as owner
        await joinCall({
          callId,
          userId: myUserId as Id<"users">,
          displayName: user?.fullName ?? "Me",
          lang: selectedLang,
          isOwner: true,
        });
        router.push(`/call/${callId}`);
      } catch (e) {
        console.error("Failed to create call:", e);
        Alert.alert("Error", "Failed to start call");
      }
    },
    [myUserId, createCall, joinCall, user, selectedLang, router],
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Llamadas</Text>
      <Text style={styles.subtitle}>
        Signed in as {user?.fullName ?? "User"}
      </Text>

      {/* Language selector */}
      <View style={styles.langRow}>
        <Text>My language: </Text>
        <TouchableOpacity
          style={[
            styles.langBtn,
            selectedLang === "es" && styles.langBtnActive,
          ]}
          onPress={() => setSelectedLang("es")}
        >
          <Text>ES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.langBtn,
            selectedLang === "en" && styles.langBtnActive,
          ]}
          onPress={() => setSelectedLang("en")}
        >
          <Text>EN</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* User list */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item: any) => item._id}
        renderItem={({ item }: { item: any }) => (
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => handleCallUser(item)}
          >
            <Text style={styles.userName}>{item.displayName}</Text>
            <Text style={styles.userLang}>{item.lang}</Text>
            <Text style={styles.callBtn}>📞 Call</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery ? "No users found" : "No other users yet"}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  langBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#eee",
  },
  langBtnActive: {
    backgroundColor: "#208AEF",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  userName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  userLang: {
    fontSize: 14,
    color: "#666",
    marginRight: 12,
  },
  callBtn: {
    fontSize: 18,
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    marginTop: 40,
  },
});
