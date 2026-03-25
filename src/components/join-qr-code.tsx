import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import * as api from "@/lib/api";

type Props = {
  waitlistId: string;
  scheme: string;
};

export function JoinQRCode({ waitlistId, scheme }: Props) {
  const theme = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const secondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const generateToken = useCallback(async () => {
    try {
      setTokenError(null);
      const result = await api.generateJoinToken(waitlistId);
      setToken(result.token);
      secondsRef.current = result.ttl_seconds;
      setSecondsLeft(result.ttl_seconds);
    } catch (e) {
      setToken(null);
      setTokenError(e instanceof Error ? e.message : "Failed to generate QR");
    }
  }, [waitlistId]);

  useEffect(() => {
    generateToken();
  }, [generateToken]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      secondsRef.current -= 1;
      setSecondsLeft(Math.max(0, secondsRef.current));

      if (secondsRef.current <= 0) {
        generateToken();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [generateToken]);

  const deepLink = token
    ? `${scheme}://join?waitlist=${waitlistId}&token=${token}`
    : null;

  const qrContent = deepLink ? (
    <QRCode
      value={deepLink}
      size={200}
      backgroundColor={theme.background}
      color={theme.text}
    />
  ) : null;

  const fullScreenQrContent = deepLink ? (
    <QRCode
      value={deepLink}
      size={300}
      backgroundColor={theme.background}
      color={theme.text}
    />
  ) : null;

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={styles.label}>
        Scan to Join
      </ThemedText>

      {qrContent ? (
        <TouchableOpacity
          style={styles.qrWrapper}
          onPress={() => setShowFullScreen(true)}
        >
          {qrContent}
          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.tapHint}
          >
            Tap to enlarge
          </ThemedText>
        </TouchableOpacity>
      ) : (
        <View
          style={[
            styles.qrPlaceholder,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <ThemedText themeColor="textSecondary">
            {tokenError ?? "Generating..."}
          </ThemedText>
        </View>
      )}

      {/* Token show/hide */}
      {token && (
        <View style={styles.tokenSection}>
          <TouchableOpacity onPress={() => setShowToken(!showToken)}>
            <ThemedText type="small" style={styles.toggleText}>
              {showToken ? "Hide token" : "Show token for manual entry"}
            </ThemedText>
          </TouchableOpacity>
          {showToken && (
            <View
              style={[
                styles.tokenBox,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText style={styles.tokenText} selectable>
                {token}
              </ThemedText>
            </View>
          )}
        </View>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Refreshes in {secondsLeft}s
      </ThemedText>

      {/* Full-screen QR modal */}
      <Modal
        visible={showFullScreen}
        animationType="fade"
        onRequestClose={() => setShowFullScreen(false)}
      >
        <ThemedView style={styles.fullScreenContainer}>
          <SafeAreaView style={styles.fullScreenSafeArea}>
            <TouchableOpacity
              style={styles.fullScreenClose}
              onPress={() => setShowFullScreen(false)}
            >
              <ThemedText type="small" style={styles.closeText}>
                Close
              </ThemedText>
            </TouchableOpacity>

            <View style={styles.fullScreenContent}>
              <ThemedText type="subtitle" style={styles.fullScreenTitle}>
                Scan to Join
              </ThemedText>

              {fullScreenQrContent ? (
                <View style={styles.fullScreenQr}>{fullScreenQrContent}</View>
              ) : (
                <ThemedText themeColor="textSecondary">
                  {tokenError ?? "Generating..."}
                </ThemedText>
              )}

              {token && (
                <View
                  style={[
                    styles.fullScreenTokenBox,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.fullScreenTokenLabel}
                  >
                    Manual entry code
                  </ThemedText>
                  <ThemedText style={styles.fullScreenTokenText} selectable>
                    {token}
                  </ThemedText>
                </View>
              )}

              <ThemedText type="small" themeColor="textSecondary">
                Refreshes in {secondsLeft}s
              </ThemedText>
            </View>
          </SafeAreaView>
        </ThemedView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qrWrapper: {
    padding: Spacing.three,
    borderRadius: 12,
    alignItems: "center",
    gap: Spacing.one,
  },
  tapHint: {
    marginTop: Spacing.one,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenSection: {
    alignItems: "center",
    gap: Spacing.one,
  },
  toggleText: {
    color: "#3c87f7",
    fontWeight: "600",
  },
  tokenBox: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  tokenText: {
    fontFamily: "monospace",
    fontSize: 13,
    letterSpacing: 1,
  },
  // Full-screen modal
  fullScreenContainer: {
    paddingVertical: Spacing.two,
    flex: 1,
  },
  fullScreenSafeArea: {
    flex: 1,
  },
  fullScreenClose: {
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  closeText: {
    color: "#3c87f7",
    fontWeight: "600",
    fontSize: 16,
  },
  fullScreenContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  fullScreenTitle: {
    textAlign: "center",
  },
  fullScreenQr: {
    padding: Spacing.four,
    borderRadius: 16,
  },
  fullScreenTokenBox: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 12,
    alignItems: "center",
    gap: Spacing.one,
  },
  fullScreenTokenLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 11,
  },
  fullScreenTokenText: {
    fontFamily: "monospace",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 3,
  },
});
