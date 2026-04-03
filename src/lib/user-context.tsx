import React, { createContext, useContext, useEffect, useState } from "react";
import { getStoredUser, setStoredUser, clearStoredUser } from "./user-store";
import { getUser } from "./api";
import { posthog } from "./posthog";
import type { User } from "./types";

type UserContextType = {
  user: User | null;
  isLoading: boolean;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getStoredUser()
      .then(async (data) => {
        if (data) {
          const stored: User = JSON.parse(data);
          setUser(stored);

          // Identify on app load so all session events are linked
          posthog.identify(stored.id, {
            name: `${stored.first_name} ${stored.last_name}`,
            first_name: stored.first_name,
            last_name: stored.last_name,
            role: stored.role,
            email: stored.email,
          });

          // Refresh from API to pick up role changes
          try {
            const fresh = await getUser(stored.id);
            setUser(fresh);
            await setStoredUser(JSON.stringify(fresh));

            // Re-identify with fresh properties if they changed
            posthog.identify(fresh.id, {
              name: `${fresh.first_name} ${fresh.last_name}`,
              first_name: fresh.first_name,
              last_name: fresh.last_name,
              role: fresh.role,
              email: fresh.email,
            });
          } catch {
            // API unavailable — keep using stored data
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  async function login(userData: User) {
    setUser(userData);
    await setStoredUser(JSON.stringify(userData));
    posthog.identify(userData.id, {
      name: `${userData.first_name} ${userData.last_name}`,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      email: userData.email,
    });
  }

  async function logout() {
    setUser(null);
    await clearStoredUser();
    posthog.reset();
  }

  return (
    <UserContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
