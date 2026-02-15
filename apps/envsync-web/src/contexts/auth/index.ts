import { createContext, useContext } from "react";
import type { WhoAmIResponse } from "@envsync-cloud/envsync-ts-sdk";

export interface IAuthContext {
  user: WhoAmIResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  allowedScopes: string[];
  authError: string | null;
}

export const AuthContext = createContext<IAuthContext | null>(null);
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      "useAuthContext must be used within an AuthContextProvider"
    );
  }
  return context;
};

export * from "./provider";
