import {
  useState,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { PlanId, isPlanId } from "@/lib/plans";

export type UserRole = "admin" | "gigworker";

interface AuthContextType {
  user: string | null;
  role: UserRole | null;
  selectedPlan: PlanId | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isGigworker: boolean;
  login: (name: string, role: UserRole, planId?: PlanId) => void;
  selectPlan: (planId: PlanId) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("klaimkavach_user");
    }
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("klaimkavach_user");
    }
    return false;
  });
  const [role, setRole] = useState<UserRole | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("klaimkavach_role");
      return saved === "admin" || saved === "gigworker" ? saved : null;
    }
    return null;
  });
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(() => {
    if (typeof window !== "undefined") {
      const savedPlan = localStorage.getItem("klaimkavach_plan");
      return isPlanId(savedPlan) ? savedPlan : null;
    }
    return null;
  });

  const login = (name: string, userRole: UserRole, planId?: PlanId) => {
    localStorage.setItem("klaimkavach_user", name);
    localStorage.setItem("klaimkavach_role", userRole);
    if (planId) {
      localStorage.setItem("klaimkavach_plan", planId);
      setSelectedPlan(planId);
    }
    setUser(name);
    setRole(userRole);
    setIsAuthenticated(true);
  };

  const selectPlan = (planId: PlanId) => {
    localStorage.setItem("klaimkavach_plan", planId);
    setSelectedPlan(planId);
  };

  const logout = () => {
    localStorage.removeItem("klaimkavach_user");
    localStorage.removeItem("klaimkavach_plan");
    localStorage.removeItem("klaimkavach_role");
    setUser(null);
    setSelectedPlan(null);
    setRole(null);
    setIsAuthenticated(false);
  };

  const isAdmin = role === "admin";
  const isGigworker = role === "gigworker";

  return (
    <AuthContext.Provider
      value={{ user, role, selectedPlan, isAuthenticated, isAdmin, isGigworker, login, selectPlan, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
