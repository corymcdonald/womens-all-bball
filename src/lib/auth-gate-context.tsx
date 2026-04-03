import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { StyledTextInput } from "@/components/ui/text-input";
import { ErrorText } from "@/components/ui/error-text";
import { useUser as useClerkUser } from "@clerk/expo";
import AuthScreen from "@/components/screens/auth";
import { SemanticColors, Spacing } from "@/constants/theme";
import { useUser } from "@/lib/user-context";
import { registerUser, getUserByClerkId } from "@/lib/api";
import { addAuthorizedWaitlist } from "@/lib/user-store";
import { posthog } from "@/lib/posthog";
import type { User } from "@/lib/types";

export type JoinContext = {
  waitlistId: string;
  token: string;
};

type AuthGateContextType = {
  requireAuth: (onAuthenticated: () => void, join?: JoinContext) => void;
};

const AuthGateContext = createContext<AuthGateContextType>({
  requireAuth: () => {},
});

type AuthMode = "guest" | "sign-in";

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const { user, login } = useUser();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<AuthMode>("guest");
  const pendingRef = useRef<(() => void) | null>(null);
  const joinContextRef = useRef<JoinContext | null>(null);

  const requireAuth = useCallback(
    (onAuthenticated: () => void, join?: JoinContext) => {
      if (user) {
        onAuthenticated();
      } else {
        pendingRef.current = onAuthenticated;
        joinContextRef.current = join ?? null;
        setMode("guest");
        setVisible(true);
      }
    },
    [user],
  );

  // When user signs in while modal is open, fire pending action and close
  useEffect(() => {
    if (user && visible) {
      setVisible(false);
      const action = pendingRef.current;
      pendingRef.current = null;
      if (action) action();
    }
  }, [user, visible]);

  function dismiss() {
    setVisible(false);
    setMode("guest");
    pendingRef.current = null;
    joinContextRef.current = null;
  }

  // Handle Clerk sign-in completion: look up Supabase user by clerk_id
  async function handleClerkSignIn(clerkUserId: string) {
    try {
      const supabaseUser = await getUserByClerkId(clerkUserId);
      await login(supabaseUser);
    } catch {
      // User doesn't exist in Supabase yet — Clerk sign-up creates one via auth.tsx
    }
  }

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      <Modal visible={visible} animationType="slide" onRequestClose={dismiss}>
        {mode === "guest" ? (
          <RegisterForm
            onDismiss={dismiss}
            onRegister={async (registeredUser, joined) => {
              if (joined && joinContextRef.current) {
                await addAuthorizedWaitlist(joinContextRef.current.waitlistId);
                // Clear pending action — the backend already joined them
                pendingRef.current = null;
                joinContextRef.current = null;
              }
              await login(registeredUser);
            }}
            onSwitchToSignIn={() => setMode("sign-in")}
            joinContext={joinContextRef.current}
          />
        ) : (
          <ClerkSignInWrapper
            onDismiss={dismiss}
            onSignedIn={handleClerkSignIn}
          />
        )}
      </Modal>
    </AuthGateContext.Provider>
  );
}

export function useAuthGate() {
  return useContext(AuthGateContext);
}

function RegisterForm({
  onDismiss,
  onRegister,
  onSwitchToSignIn,
  joinContext,
}: {
  onDismiss: () => void;
  onSwitchToSignIn: () => void;
  onRegister: (user: User, joined: boolean) => Promise<void>;
  joinContext: JoinContext | null;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = firstName.trim() && lastName.trim() && !submitting;

  async function handleRegister() {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);

    try {
      const result = await registerUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(joinContext
          ? {
              waitlist_id: joinContext.waitlistId,
              token: joinContext.token,
            }
          : {}),
      });
      // Identify before capturing so the event is linked with person properties
      posthog.identify(result.id, {
        name: `${result.first_name} ${result.last_name}`,
        first_name: result.first_name,
        last_name: result.last_name,
        role: result.role,
        email: result.email,
      });
      posthog.capture("player_registered");
      await onRegister(result, !!result.joined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.title}>
            Get on the List
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Enter your name to start playing
          </ThemedText>

          <View style={styles.form}>
            <StyledTextInput
              placeholder="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
            />
            <StyledTextInput
              placeholder="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
            />
            <StyledTextInput
              placeholder="Email (optional)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <ErrorText message={error} />

          <Button
            label={submitting ? "Joining..." : "Continue as Guest"}
            onPress={handleRegister}
            disabled={!canSubmit}
            style={styles.button}
          />

          <TouchableOpacity onPress={onSwitchToSignIn} style={styles.signInRow}>
            <ThemedText type="small" style={styles.linkText}>
              Sign Into Your Account
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDismiss} style={styles.cancelButton}>
            <ThemedText themeColor="textSecondary">Cancel</ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/**
 * Wraps the Clerk AuthScreen for use in the auth gate modal.
 * After Clerk auth completes, looks up the Supabase user and logs them in.
 */
function ClerkSignInWrapper({
  onDismiss,
  onSignedIn,
}: {
  onDismiss: () => void;
  onSignedIn: (clerkUserId: string) => void;
}) {
  const { user: clerkUser } = useClerkUser();

  useEffect(() => {
    if (clerkUser?.id) {
      onSignedIn(clerkUser.id);
    }
  }, [clerkUser?.id, onSignedIn]);

  return <AuthScreen onDismiss={onDismiss} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: "center",
    gap: Spacing.three,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.three,
  },
  form: {
    gap: Spacing.two,
  },
  button: {
    marginTop: Spacing.two,
  },
  signInRow: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  linkText: {
    color: SemanticColors.primary,
    fontWeight: "600",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
