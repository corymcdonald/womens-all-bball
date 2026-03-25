import { ActivityIndicator } from "react-native";

import { ThemedView } from "@/components/themed-view";
import { useUser } from "@/lib/user-context";
import RegisterScreen from "@/components/screens/register";
import HomeScreen from "@/components/screens/home";

export default function Index() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!user) {
    return <RegisterScreen />;
  }

  return <HomeScreen />;
}
