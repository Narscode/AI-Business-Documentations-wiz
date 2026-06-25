"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";

interface UserContextValue {
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  loading: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api<User[]>("/api/users");
        if (cancelled) return;
        setUsers(list);
        const storedId =
          typeof window !== "undefined"
            ? window.localStorage.getItem("kvp.userId")
            : null;
        const initial =
          (storedId && list.find((u) => u.id === Number(storedId))) ||
          list.find((u) => u.role === "admin") ||
          list[0] ||
          null;
        if (initial) {
          setCurrentUserState(initial);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("kvp.userId", String(initial.id));
          }
        }
      } catch (e) {
        console.error("Failed to load users", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrentUser = (user: User) => {
    setCurrentUserState(user);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kvp.userId", String(user.id));
    }
  };

  return (
    <UserContext.Provider value={{ users, currentUser, setCurrentUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside UserProvider");
  return ctx;
}
