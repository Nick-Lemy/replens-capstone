import type { SavedSession } from "./types";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("replens", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("sessions", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Device storage is unavailable. Your analysis is still visible.",
        ),
      );
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", mode);
    const request = action(tx.objectStore("sessions"));

    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };

    tx.onabort = () => {
      db.close();
      reject(
        new Error("Could not save to this device. Check available storage."),
      );
    };

    tx.onerror = () => {
      db.close();
      reject(new Error("Device storage could not be updated."));
    };
  });
}

export const historyStore = {
  list: async () =>
    ((await transaction("readonly", (s) => s.getAll())) as SavedSession[]).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    ),

  save: (session: SavedSession) =>
    transaction("readwrite", (s) => s.put(session)),

  remove: (id: string) => transaction("readwrite", (s) => s.delete(id)),
};
