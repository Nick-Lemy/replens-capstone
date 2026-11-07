import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { authApi } from "./api";

export function useAuth() {
  const client = useQueryClient();
  const status = useQuery({ queryKey: ["auth", "status"], queryFn: authApi.status });
  const account = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return (await authApi.me()).user;
      } catch {
        return null;
      }
    },
    enabled: status.data?.enabled === true,
  });
  const refresh = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ["auth", "me"] });
  }, [client]);
  const logout = useMutation({ mutationFn: authApi.logout, onSuccess: refresh });

  return { enabled: status.data?.enabled === true, account: account.data, refresh, logout };
}
