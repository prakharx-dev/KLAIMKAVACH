import {
  useState,
  createContext,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { PlanId, isPlanId } from "@/lib/plans";

interface AuthContextType {
  user: string | null;
  selectedPlan: PlanId | null;
  isAuthenticated: boolean;
  login: (name: string, planId?: PlanId) => void;
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
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(() => {
    if (typeof window !== "undefined") {
      const savedPlan = localStorage.getItem("klaimkavach_plan");
      return isPlanId(savedPlan) ? savedPlan : null;
    }
    return null;
  });

  const login = (name: string, planId?: PlanId) => {
    localStorage.setItem("klaimkavach_user", name);
    if (planId) {
      localStorage.setItem("klaimkavach_plan", planId);
      setSelectedPlan(planId);
    }
    setUser(name);
    setIsAuthenticated(true);
  };

  const selectPlan = (planId: PlanId) => {
    localStorage.setItem("klaimkavach_plan", planId);
    setSelectedPlan(planId);
  };

  const logout = () => {
    localStorage.removeItem("klaimkavach_user");
    localStorage.removeItem("klaimkavach_plan");
    setUser(null);
    setSelectedPlan(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, selectedPlan, isAuthenticated, login, selectPlan, logout }}
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
