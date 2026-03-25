import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.backgroundSelected,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}
    >
      <Skeleton width={120} height={12} />
      <View style={styles.row}>
        <View style={styles.col}>
          <Skeleton width={80} height={14} />
          <Skeleton width="90%" height={12} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="80%" height={12} />
          <Skeleton width="85%" height={12} />
          <Skeleton width="75%" height={12} />
        </View>
        <View style={styles.col}>
          <Skeleton width={80} height={14} />
          <Skeleton width="90%" height={12} />
          <Skeleton width="70%" height={12} />
          <Skeleton width="80%" height={12} />
          <Skeleton width="85%" height={12} />
          <Skeleton width="75%" height={12} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonQueueItem() {
  const theme = useTheme();
  return (
    <View
      style={[styles.queueItem, { backgroundColor: theme.backgroundElement }]}
    >
      <Skeleton width={28} height={28} borderRadius={14} />
      <Skeleton width="60%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.two,
    borderRadius: 10,
    gap: Spacing.two,
  },
});
