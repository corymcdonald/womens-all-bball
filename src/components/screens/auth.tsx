import { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSignIn, useSignUp } from "@clerk/expo";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useUser } from "@/lib/user-context";
import { registerUser } from "@/lib/api";
import { posthog } from "@/lib/posthog";

type Mode = "sign-in" | "sign-up";

function formatClerkError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "errors" in e) {
    const errors = (e as { errors: { longMessage?: string }[] }).errors;
    return errors[0]?.longMessage ?? "An error occurred";
  }
  return "An error occurred";
}

export default function AuthScreen({
  onDismiss,
  linkOnly,
}: {
  onDismiss?: () => void;
  linkOnly?: boolean;
} = {}) {
  const [mode, setMode] = useState<Mode>("sign-in");

  return mode === "sign-in" ? (
    <SignInForm onSwitchMode={() => setMode("sign-up")} onDismiss={onDismiss} />
  ) : (
    <SignUpForm
      onSwitchMode={() => setMode("sign-in")}
      onDismiss={onDismiss}
      linkOnly={linkOnly}
    />
  );
}

type ResetStep = "idle" | "code" | "password";

function SignInForm({
  onSwitchMode,
  onDismiss,
}: {
  onSwitchMode: () => void;
  onDismiss?: () => void;
}) {
  const theme = useTheme();
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Forgot password state
  const [resetStep, setResetStep] = useState<ResetStep>("idle");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const canSubmit = email.trim() && password && !submitting;

  async function handleSignIn() {
    if (!canSubmit || !signIn) return;
    setError("");
    setSubmitting(true);

    try {
      const { error: pwError } = await signIn.password({
        identifier: email.trim(),
        password,
      });

      if (pwError) {
        setError(pwError.message ?? "Sign-in failed");
        return;
      }

      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message ?? "Could not complete sign-in");
          return;
        }
        posthog.capture("user_signed_in");
      } else {
        setError("Sign-in could not be completed. Please try again.");
      }
    } catch (e: unknown) {
      setError(formatClerkError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim() || !signIn) {
      setError("Enter your email first");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      // Start a sign-in to get access to resetPasswordEmailCode
      const { error: createError } = await signIn.create({
        identifier: email.trim(),
      });
      if (createError) {
        setError(createError.message ?? "Could not start reset");
        return;
      }

      const { error: sendError } =
        await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) {
        setError(sendError.message ?? "Could not send reset code");
        return;
      }

      setResetStep("code");
    } catch (e: unknown) {
      setError(formatClerkError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyResetCode() {
    if (!resetCode.trim() || !signIn) return;
    setError("");
    setSubmitting(true);

    try {
      const { error: verifyError } =
        await signIn.resetPasswordEmailCode.verifyCode({
          code: resetCode.trim(),
        });
      if (verifyError) {
        setError(verifyError.message ?? "Invalid code");
        return;
      }

      setResetStep("password");
    } catch (e: unknown) {
      setError(formatClerkError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitNewPassword() {
    if (!newPassword || newPassword.length < 8 || !signIn) return;
    setError("");
    setSubmitting(true);

    try {
      const { error: resetError } =
        await signIn.resetPasswordEmailCode.submitPassword({
          password: newPassword,
        });
      if (resetError) {
        setError(resetError.message ?? "Could not reset password");
        return;
      }

      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message ?? "Could not complete sign-in");
          return;
        }
        posthog.capture("password_reset");
      }
    } catch (e: unknown) {
      setError(formatClerkError(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Reset code entry step
  if (resetStep === "code") {
    return (
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <SafeAreaView style={styles.safeArea}>
            <ThemedText type="title" style={styles.title}>
              Check Your Email
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Enter the code we sent to {email}
            </ThemedText>

            <ThemedView style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
                placeholder="Verification code"
                placeholderTextColor={theme.textSecondary}
                value={resetCode}
                onChangeText={setResetCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
            </ThemedView>

            {error ? (
              <ThemedText style={styles.error}>{error}</ThemedText>
            ) : null}

            <TouchableOpacity
              style={[
                styles.button,
                (!resetCode.trim() || submitting) && styles.buttonDisabled,
              ]}
              onPress={handleVerifyResetCode}
              disabled={!resetCode.trim() || submitting}
            >
              <ThemedText
                style={styles.buttonText}
                themeColor={
                  resetCode.trim() && !submitting
                    ? "background"
                    : "textSecondary"
                }
              >
                {submitting ? "Verifying..." : "Verify Code"}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setResetStep("idle");
                setResetCode("");
                setError("");
              }}
              style={styles.cancelButton}
            >
              <ThemedText themeColor="textSecondary">
                Back to Sign In
              </ThemedText>
            </TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  // New password entry step
  if (resetStep === "password") {
    const canReset = newPassword.length >= 8 && !submitting;
    return (
      <ThemedView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          <SafeAreaView style={styles.safeArea}>
            <ThemedText type="title" style={styles.title}>
              New Password
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Choose a new password (min 8 characters)
            </ThemedText>

            <ThemedView style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.backgroundElement,
                  },
                ]}
                placeholder="New password"
                placeholderTextColor={theme.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="password-new"
              />
            </ThemedView>

            {error ? (
              <ThemedText style={styles.error}>{error}</ThemedText>
            ) : null}

            <TouchableOpacity
              style={[styles.button, !canReset && styles.buttonDisabled]}
              onPress={handleSubmitNewPassword}
              disabled={!canReset}
            >
              <ThemedText
                style={styles.buttonText}
                themeColor={canReset ? "background" : "textSecondary"}
              >
                {submitting ? "Resetting..." : "Reset Password"}
              </ThemedText>
            </TouchableOpacity>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  // Normal sign-in form
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.title}>
            Welcome Back
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Sign in to continue
          </ThemedText>

          <ThemedView style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </ThemedView>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={!canSubmit}
          >
            <ThemedText
              style={styles.buttonText}
              themeColor={canSubmit ? "background" : "textSecondary"}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword}>
            <ThemedText type="small" style={styles.linkText}>
              Forgot password?
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <ThemedText themeColor="textSecondary">
              {"Don't have an account?"}
            </ThemedText>
            <TouchableOpacity onPress={onSwitchMode}>
              <ThemedText style={styles.linkText}>Sign Up</ThemedText>
            </TouchableOpacity>
          </View>

          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.cancelButton}>
              <ThemedText themeColor="textSecondary">Cancel</ThemedText>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function SignUpForm({
  onSwitchMode,
  onDismiss,
  linkOnly,
}: {
  onSwitchMode: () => void;
  onDismiss?: () => void;
  linkOnly?: boolean;
}) {
  const theme = useTheme();
  const { signUp } = useSignUp();
  const { login } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    email.trim() &&
    password.length >= 8 &&
    firstName.trim() &&
    lastName.trim() &&
    !submitting;

  async function handleSignUp() {
    if (!canSubmit || !signUp) return;
    setError("");
    setSubmitting(true);

    try {
      // Create sign-up with email + password in one step
      const { error: pwError } = await signUp.password({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (pwError) {
        setError(pwError.message ?? "Sign-up failed");
        return;
      }

      if (signUp.status === "complete") {
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          setError(finalizeError.message ?? "Could not complete sign-up");
          return;
        }

        if (linkOnly) {
          // Caller (Settings) handles linking clerk_id to existing user
          posthog.capture("clerk_signup_for_link");
        } else {
          // Standalone sign-up: create a new Supabase user
          const supabaseUser = await registerUser({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            clerk_id: signUp.createdUserId!,
          });
          posthog.capture("player_registered", { user_id: supabaseUser.id });
          await login(supabaseUser);
        }
      } else {
        setError("Sign-up could not be completed. Please try again.");
      }
    } catch (e: unknown) {
      setError(formatClerkError(e));
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
            Join the League
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Create your account to get started
          </ThemedText>

          <ThemedView style={styles.form}>
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
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                },
              ]}
              placeholder="Password (min 8 characters)"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password-new"
            />
          </ThemedView>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={!canSubmit}
          >
            <ThemedText
              style={styles.buttonText}
              themeColor={canSubmit ? "background" : "textSecondary"}
            >
              {submitting ? "Creating account..." : "Create Account"}
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <ThemedText themeColor="textSecondary">
              Already have an account?
            </ThemedText>
            <TouchableOpacity onPress={onSwitchMode}>
              <ThemedText style={styles.linkText}>Sign In</ThemedText>
            </TouchableOpacity>
          </View>

          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.cancelButton}>
              <ThemedText themeColor="textSecondary">Cancel</ThemedText>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
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
