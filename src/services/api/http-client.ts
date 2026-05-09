import { supabase } from "@/integrations/supabase/client";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type RequestOptions = { method?: HttpMethod; body?: unknown; headers?: Record<string, string>; };
async function getAccessToken(): Promise<string | null> { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null; }
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${API_URL}${path}`, { method: options.method ?? "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers ?? {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.error || `API error ${response.status}`);
  return payload as T;
}
