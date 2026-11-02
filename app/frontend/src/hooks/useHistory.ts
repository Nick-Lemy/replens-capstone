import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { historyStore } from "../lib/history";
import type { SavedSession } from "../lib/types";

export function useHistory() {
  const client = useQueryClient();

  const sessions = useQuery({
    queryKey: ["history"],
    queryFn: historyStore.list,
  });

  const invalidate = () =>
    void client.invalidateQueries({ queryKey: ["history"] });

  const save = useMutation({
    mutationFn: (session: SavedSession) => historyStore.save(session),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: historyStore.remove,
    onSuccess: invalidate,
  });

  return { sessions, save, remove };
}
