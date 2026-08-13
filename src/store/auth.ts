import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  avatar: string | null;
}

export interface AuthTenant {
  id: string;
  name: string;
  slug: string;
  type: string;
  tier: string;
  currency: string;
  taxRate: number;
  logo: string | null;
}

interface AuthState {
  user: AuthUser | null;
  tenant: AuthTenant | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, tenant: AuthTenant) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,

  setAuth: (user, tenant) => {
    set({
      user,
      tenant,
      isAuthenticated: true,
    });
  },

  clearAuth: () => {
    set({
      user: null,
      tenant: null,
      isAuthenticated: false,
    });
  },
}));
