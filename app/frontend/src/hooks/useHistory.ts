import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountVideoStore, historyStore } from "../lib/history";
import type { SavedSession } from "../lib/types";
import { sessionApi } from "../features/history/api";

export function useHistory(accountId: number | null, ready: boolean) {
  const client = useQueryClient();
  const queryKey = ["history", accountId ?? "guest"];

  const sessions = useQuery({
    queryKey,
    enabled: ready,
    queryFn: async () => {
      if (accountId === null) return historyStore.list();
      const records = await sessionApi.list();
      return Promise.all(
        records.map(async (record) => ({
          ...record,
          video:
            (await accountVideoStore
              .get(accountId, record.id)
              .catch(() => null)) ?? null,
        })),
      );
    },
  });

  const invalidate = () => void client.invalidateQueries({ queryKey });

  const save = useMutation({
    mutationFn: async (session: SavedSession) => {
      if (accountId === null) return historyStore.save(session);
      await sessionApi.save(session);
      if (session.video) {
        await accountVideoStore
          .save(accountId, session.id, session.video)
          .catch(() => undefined);
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (accountId === null) return historyStore.remove(id);
      await sessionApi.remove(id);
      await accountVideoStore.remove(accountId, id).catch(() => undefined);
    },
    onSuccess: invalidate,
  });

  return { sessions, save, remove };
}
