import { useRef, useState } from "react";
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  isAuthorized: boolean;
  onQuickJoin: () => void;
  onTokenJoin: (token: string) => void;
  onScanJoin: (waitlistId: string, token: string) => void;
  setError: (msg: string) => void;
};

export function JoinSection({
  isAuthorized,
  onQuickJoin,
  onTokenJoin,
  onScanJoin,
  setError,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [showScanner, setShowScanner] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanProcessedRef = useRef(false);

  async function handleOpenScanner() {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setError("Camera permission is required to scan QR codes");
        return;
      }
    }
    scanProcessedRef.current = false;
    setShowScanner(true);
  }

  function handleBarCodeScanned({ data: url }: { data: string }) {
    if (scanProcessedRef.current) return;
    scanProcessedRef.current = true;
    setShowScanner(false);

    try {
      const parsed = new URL(url);
      const waitlistId = parsed.searchParams.get("waitlist");
      const token = parsed.searchParams.get("token");

      if (!waitlistId || !token) {
        setError("Invalid QR code");
        return;
      }

      onScanJoin(waitlistId, token);
    } catch {
      setError("Invalid QR code");
    }
  }

  if (isAuthorized) {
    return (
      <TouchableOpacity style={styles.primaryButton} onPress={onQuickJoin}>
        <ThemedText style={styles.buttonText} themeColor="background">
          Join Waitlist
        </ThemedText>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleOpenScanner}
      >
        <ThemedText style={styles.buttonText} themeColor="background">
          Scan QR Code to Join
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowManual(!showManual)}>
        <ThemedText type="small" themeColor="textSecondary">
          {showManual ? "Hide token entry" : "Or enter token manually"}
        </ThemedText>
      </TouchableOpacity>

      {showManual && (
        <View style={styles.manualSection}>
          <TextInput
            style={[
              styles.tokenInput,
              {
                color: theme.text,
                backgroundColor: theme.backgroundElement,
              },
            ]}
            placeholder="Enter token from staff"
            placeholderTextColor={theme.textSecondary}
            value={manualToken}
            onChangeText={setManualToken}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              !manualToken.trim() && styles.buttonDisabled,
            ]}
            onPress={() => {
              onTokenJoin(manualToken.trim());
              setManualToken("");
            }}
            disabled={!manualToken.trim()}
          >
            <ThemedText style={styles.buttonText} themeColor="background">
              Join
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {/* QR Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.scanner}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          <View style={styles.scannerOverlay} pointerEvents="box-none">
            <View
              style={[
                styles.scannerTopBar,
                { paddingTop: insets.top + Spacing.two },
              ]}
            >
              <TouchableOpacity
                style={styles.scannerCloseButton}
                onPress={() => setShowScanner(false)}
              >
                <ThemedText style={styles.scannerCloseText}>
                  Cancel
                </ThemedText>
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.scannerBottomBar,
                { paddingBottom: insets.bottom + Spacing.four },
              ]}
            >
              <ThemedText style={styles.scannerHint}>
                Point your camera at the QR code on the staff's screen
              </ThemedText>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    alignItems: "center",
  },
  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#3c87f7",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  secondaryButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3c87f7",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  manualSection: {
    gap: Spacing.two,
    alignSelf: "stretch",
  },
  tokenInput: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
    textAlign: "center",
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  scannerTopBar: {
    alignItems: "flex-end",
    paddingHorizontal: Spacing.four,
  },
  scannerBottomBar: {
    alignItems: "center",
    paddingHorizontal: Spacing.four,
  },
  scannerCloseButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 10,
  },
  scannerCloseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  scannerHint: {
    color: "#fff",
    textAlign: "center",
    fontSize: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
});
