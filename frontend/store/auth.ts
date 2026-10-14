import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TokenPair, User } from "@/lib/types";

type AuthState = {
  tokens: TokenPair | null;
  user: User | null;
  setAuth: (tokens: TokenPair, user: User) => void;
  setUser: (user: User) => void;
  setTokens: (tokens: TokenPair) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      tokens: null,
      user: null,
      setAuth: (tokens, user) => set({ tokens, user }),
      setUser: (user) => set({ user }),
      setTokens: (tokens) => set({ tokens }),
      clear: () => set({ tokens: null, user: null }),
    }),
    {
      name: "teamspace-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tokens: state.tokens, user: state.user }) as AuthState,
    },
  ),
);
