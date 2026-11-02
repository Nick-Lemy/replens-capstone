const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api${path}`, init);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail
              .map(
                (item: { loc?: (string | number)[]; msg?: string }) =>
                  `${item.loc?.filter((part) => part !== "body").join(".") || "Review"}: ${item.msg ?? "Invalid value"}`,
              )
              .join("; ")
          : "The analyzer could not be reached. Check the backend and try again.",
    );
  }

  return response.status === 204 ? (undefined as T) : response.json();
}
