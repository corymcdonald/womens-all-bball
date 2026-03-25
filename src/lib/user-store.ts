import { Platform } from "react-native";

const USER_KEY = "user_data";
const AUTHORIZED_WAITLISTS_KEY = "authorized_waitlists";

export async function getStoredUser(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(USER_KEY);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(USER_KEY);
}

export async function setStoredUser(value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(USER_KEY, value);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(USER_KEY, value);
}

export async function clearStoredUser(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(AUTHORIZED_WAITLISTS_KEY);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(USER_KEY);
  await SecureStore.deleteItemAsync(AUTHORIZED_WAITLISTS_KEY);
}

// Track which waitlists the user has successfully joined
async function getStore(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

async function setStore(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(key, value);
}

export async function getAuthorizedWaitlists(): Promise<string[]> {
  const data = await getStore(AUTHORIZED_WAITLISTS_KEY);
  return data ? JSON.parse(data) : [];
}

export async function addAuthorizedWaitlist(waitlistId: string): Promise<void> {
  const current = await getAuthorizedWaitlists();
  if (!current.includes(waitlistId)) {
    current.push(waitlistId);
    await setStore(AUTHORIZED_WAITLISTS_KEY, JSON.stringify(current));
  }
}
