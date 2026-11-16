import type { SavedSession } from "./types";

type StoredBinary = {
  __replensBinary: true;
  type: string;
  data: ArrayBuffer;
};

function isStoredBinary(value: unknown): value is StoredBinary {
  return Boolean(
    value &&
      typeof value === "object" &&
      "__replensBinary" in value &&
      value.__replensBinary === true &&
      "data" in value &&
      value.data instanceof ArrayBuffer,
  );
}

function restoreBinary(value: unknown): Blob | null {
  if (value instanceof Blob) return value;
  if (isStoredBinary(value)) return new Blob([value.data], { type: value.type });
  return null;
}

async function saveWithBlobFallback<T>(
  value: Blob,
  save: (stored: Blob | StoredBinary) => Promise<T>,
): Promise<T> {
  try {
    return await save(value);
  } catch {
    return save({
      __replensBinary: true,
      type: value.type,
      data: await value.arrayBuffer(),
    });
  }
}

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
  list: async () => {
    const records = (await transaction("sessions", "readonly", (s) =>
      s.getAll(),
    )) as (Omit<SavedSession, "video"> & { video: unknown })[];
    const sessions = records.map((record) => ({
      ...record,
      video: restoreBinary(record.video),
    })) as SavedSession[];
    return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  save: (session: SavedSession) => {
    const put = (video: Blob | StoredBinary) =>
      transaction("sessions", "readwrite", (s) =>
        s.put({ ...session, video }),
      );
    return session.video
      ? saveWithBlobFallback(session.video, put)
      : transaction("sessions", "readwrite", (s) => s.put(session));
  },

  remove: (id: string) =>
    transaction("sessions", "readwrite", (s) => s.delete(id)),
};

export const accountVideoStore = {
  get: async (userId: number, sessionId: string) => {
    const value = await transaction<unknown>("accountVideos", "readonly", (s) =>
      s.get(`${userId}:${sessionId}`),
    );
    return restoreBinary(value) ?? undefined;
  },
  save: (userId: number, sessionId: string, video: Blob) => {
    const put = (stored: Blob | StoredBinary) =>
      transaction("accountVideos", "readwrite", (s) =>
        s.put(stored, `${userId}:${sessionId}`),
      );
    return saveWithBlobFallback(video, put);
  },
  remove: (userId: number, sessionId: string) =>
    transaction("accountVideos", "readwrite", (s) =>
      s.delete(`${userId}:${sessionId}`),
    ),
};
