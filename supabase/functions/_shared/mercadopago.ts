// Configuración compartida Mercado Pago - ScorpionFlow Beta
// IMPORTANTE: el ACCESS_TOKEN solo se usa en backend (Edge Functions).

export const MP_API = "https://api.mercadopago.com";

export const BUSINESS_PLAN = {
  id: "business",
  amount: 90,
  currency: "PEN",
  reason: "ScorpionFlow Business — Beta",
  frequency: 1,
  frequency_type: "months" as const,
};

export function getMpToken(): string {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  return token;
}

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.error === "string") return d.error;
    if (typeof d.cause === "string") return d.cause;
  }
  return fallback;
}

export async function mpFetch(path: string, init: RequestInit = {}) {
  const token = getMpToken();
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    console.error("[mercadopago] API error", { status: res.status, path, data });
    throw new Error(getErrorMessage(data, `Mercado Pago respondió ${res.status}`));
  }

  return data as any;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
