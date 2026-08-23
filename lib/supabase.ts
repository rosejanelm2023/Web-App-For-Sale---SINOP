type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function supabaseRequest<T>(
  path: string,
  init: RequestInit & { body?: string } = {},
): Promise<T> {
  if (!url || !anonKey) throw new Error("Supabase environment variables are not configured.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export function callRpc<T>(name: string, args: Record<string, Json>): Promise<T> {
  return supabaseRequest<T>(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}
