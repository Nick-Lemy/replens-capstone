import type { SavedSession } from "./types";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("replens", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("sessions")) {
        request.result.createObjectStore("sessions", { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains("accountVideos")) {
        request.result.createObjectStore("accountVideos");
      }
    };
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
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));

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
    (
      (await transaction("sessions", "readonly", (s) =>
        s.getAll(),
      )) as SavedSession[]
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  save: (session: SavedSession) =>
    transaction("sessions", "readwrite", (s) => s.put(session)),

  remove: (id: string) =>
    transaction("sessions", "readwrite", (s) => s.delete(id)),
};

export const accountVideoStore = {
  get: (userId: number, sessionId: string) =>
    transaction("accountVideos", "readonly", (s) =>
      s.get(`${userId}:${sessionId}`),
    ) as Promise<Blob | undefined>,
  save: (userId: number, sessionId: string, video: Blob) =>
    transaction("accountVideos", "readwrite", (s) =>
      s.put(video, `${userId}:${sessionId}`),
    ),
  remove: (userId: number, sessionId: string) =>
    transaction("accountVideos", "readwrite", (s) =>
      s.delete(`${userId}:${sessionId}`),
    ),
};
