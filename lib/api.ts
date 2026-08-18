export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      data?.error?.code ?? "ERROR",
      data?.error?.message ?? "Request failed",
    );
  }
  return data as T;
}

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  organizationId: string;
  organizationName: string;
  roleKey: string;
  permissions: string[];
};
