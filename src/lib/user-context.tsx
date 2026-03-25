import React, { createContext, useContext, useEffect, useState } from "react";
import { getStoredUser, setStoredUser, clearStoredUser } from "./user-store";
import { getUser } from "./api";

type User = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: "player" | "admin";
};

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

          // Refresh from API to pick up role changes
          try {
            const fresh = await getUser(stored.id);
            setUser(fresh);
            await setStoredUser(JSON.stringify(fresh));
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
  }

  async function logout() {
    setUser(null);
    await clearStoredUser();
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
