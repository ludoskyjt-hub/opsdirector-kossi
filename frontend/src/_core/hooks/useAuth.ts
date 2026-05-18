import { trpc } from "@/lib/trpc";
import { clearOpsToken } from "@/lib/auth";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false } = options ?? {};
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { clearOpsToken(); utils.auth.me.setData(undefined, null); },
  });

  const logout = useCallback(async () => {
    try { await logoutMutation.mutateAsync(); } catch { clearOpsToken(); }
    finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      navigate("/");
    }
  }, [logoutMutation, utils, navigate]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || logoutMutation.isPending,
    error: meQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || state.loading || state.user) return;
    navigate("/");
  }, [redirectOnUnauthenticated, state.loading, state.user, navigate]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
