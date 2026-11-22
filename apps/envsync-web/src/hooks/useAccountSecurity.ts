import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { accountApi, type MfaEnrollment } from "@/api/account.api";
import { ApiRequestError } from "@/api";

function messageFrom(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && error.message) return error.message;
  return fallback;
}

export function useAccountSecurity(enabled: boolean) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string>();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [mfaError, setMfaError] = useState<string>();

  const security = useQuery({
    queryKey: ["account-security"],
    queryFn: () => accountApi.security(),
    enabled,
    retry: 1,
  });

  const setPasswordMutation = useMutation({
    mutationFn: () => accountApi.setPassword(password),
    onSuccess: async () => {
      setPassword("");
      setConfirm("");
      setPasswordError(undefined);
      toast.success("Password set");
      await queryClient.invalidateQueries({ queryKey: ["account-security"] });
    },
    onError: (error) => setPasswordError(messageFrom(error, "Choose a different password.")),
  });

  const setupMfa = useMutation({
    mutationFn: () => accountApi.setupMfa(),
    onSuccess: (result) => {
      setEnrollment(result);
      setCode("");
      setMfaError(undefined);
    },
    onError: (error) => setMfaError(messageFrom(error, "Authenticator setup could not start.")),
  });

  const confirmMfa = useMutation({
    mutationFn: () => accountApi.confirmMfa(code),
    onSuccess: async () => {
      setEnrollment(null);
      setCode("");
      setMfaError(undefined);
      toast.success("Authenticator is on");
      await queryClient.invalidateQueries({ queryKey: ["account-security"] });
    },
    onError: (error) => setMfaError(messageFrom(error, "That code is not valid.")),
  });

  const disableMfa = useMutation({
    mutationFn: () => accountApi.disableMfa(),
    onSuccess: async () => {
      setMfaError(undefined);
      toast.success("Authenticator is off");
      await queryClient.invalidateQueries({ queryKey: ["account-security"] });
    },
    onError: (error) => setMfaError(messageFrom(error, "The authenticator could not be turned off.")),
  });

  return {
    security: security.data,
    isSecurityLoading: security.isLoading,
    securityError: security.error ? messageFrom(security.error, "Sign-in settings could not be loaded.") : undefined,
    password,
    confirm,
    passwordError,
    setPasswordValue: (value: string) => {
      setPassword(value);
      setPasswordError(undefined);
    },
    setConfirm,
    submitPassword: () => {
      if (password.length < 8) {
        setPasswordError("Use at least 8 characters.");
        return;
      }
      if (password !== confirm) {
        setPasswordError("Those passwords do not match.");
        return;
      }
      setPasswordMutation.mutate();
    },
    isSettingPassword: setPasswordMutation.isPending,
    enrollment,
    code,
    setCode,
    mfaError,
    startMfa: () => setupMfa.mutate(),
    confirmMfaCode: () => confirmMfa.mutate(),
    cancelMfa: () => {
      setEnrollment(null);
      setCode("");
      setMfaError(undefined);
    },
    disableMfa: () => disableMfa.mutate(),
    isMfaWorking: setupMfa.isPending || confirmMfa.isPending || disableMfa.isPending,
  };
}
