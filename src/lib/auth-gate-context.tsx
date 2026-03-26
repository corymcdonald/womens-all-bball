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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useUser as useClerkUser } from "@clerk/expo";
import AuthScreen from "@/components/screens/auth";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@/lib/user-context";
import { registerUser, getUserByClerkId } from "@/lib/api";
import { posthog } from "@/lib/posthog";

type AuthGateContextType = {
  requireAuth: (onAuthenticated: () => void) => void;
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

  const requireAuth = useCallback(
    (onAuthenticated: () => void) => {
      if (user) {
        onAuthenticated();
      } else {
        pendingRef.current = onAuthenticated;
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
            onRegister={login}
            onSwitchToSignIn={() => setMode("sign-in")}
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
}: {
  onDismiss: () => void;
  onSwitchToSignIn: () => void;
  onRegister: (user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    clerk_id: string | null;
    role: "player" | "admin";
  }) => Promise<void>;
}) {
  const theme = useTheme();
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
      const user = await registerUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      posthog.capture("player_registered", { user_id: user.id });
      await onRegister(user);
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
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="First name"
              placeholderTextColor={theme.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Last name"
              placeholderTextColor={theme.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              autoComplete="family-name"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Email (optional)"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit}
          >
            <ThemedText
              style={styles.buttonText}
              themeColor={canSubmit ? "background" : "textSecondary"}
            >
              {submitting ? "Joining..." : "Continue as Guest"}
            </ThemedText>
          </TouchableOpacity>

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
  }, [clerkUser?.id]);

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
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  error: {
    color: "#ef4444",
    textAlign: "center",
  },
  button: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#3c87f7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  signInRow: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  linkText: {
    color: "#3c87f7",
    fontWeight: "600",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
});
