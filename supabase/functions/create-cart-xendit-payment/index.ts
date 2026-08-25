import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

const XENDIT_SESSIONS_URL = "https://api.xendit.co/sessions";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Order = {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  total: number | string | null;
  payment_status: string | null;
  order_status: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function safeName(value: string | null, fallback: string) {
  const cleaned = (value ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return cleaned || fallback;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

    const authorization = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: "Authentication service is not configured." }, 500);

    let user: { id: string } | null = null;
    if (authorization) {
      if (!authorization.match(/^Bearer\s+\S+$/i)) return jsonResponse({ error: "Invalid authorization header." }, 401);
      const customerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization } },
      });
      const { data: userData, error: userError } = await customerSupabase.auth.getUser();
      if (userError || !userData?.user) return jsonResponse({ error: "Authentication is invalid." }, 401);
      user = userData.user;
    }

    let input: unknown;
    try { input = await req.json(); } catch { return jsonResponse({ error: "Request body must be valid JSON." }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || typeof (input as { orderId?: unknown }).orderId !== "string" || !(input as { orderId: string }).orderId.trim()) {
      return jsonResponse({ error: "A non-empty orderId is required." }, 400);
    }

    const request = input as { orderId: string; guestEmail?: unknown };
    const orderId = request.orderId.trim();
    let order: Order | null = null;
    let orderError: { message?: string; code?: string } | null = null;
    if (user) {
      const customerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization as string } },
      });
      const result = await customerSupabase
        .from("orders")
        .select("id, order_number, customer_id, email, first_name, last_name, created_at, total, payment_status, order_status")
        .eq("id", orderId)
        .eq("customer_id", user.id)
        .maybeSingle() as { data: Order | null; error: { message?: string; code?: string } | null };
      order = result.data;
      orderError = result.error;
    } else {
      if (typeof request.guestEmail !== "string" || !request.guestEmail.trim()) {
        return jsonResponse({ error: "A guest checkout email is required." }, 400);
      }
      const result = await ctx.supabaseAdmin
        .from("orders")
        .select("id, order_number, customer_id, email, first_name, last_name, created_at, total, payment_status, order_status")
        .eq("id", orderId)
        .is("customer_id", null)
        .maybeSingle() as { data: Order | null; error: { message?: string; code?: string } | null };
      order = result.data;
      orderError = result.error;
      if (order && String(order.email || "").trim().toLowerCase() !== request.guestEmail.trim().toLowerCase()) {
        order = null;
      }
      if (order && (!order.created_at || Date.now() - new Date(order.created_at).getTime() > 24 * 60 * 60 * 1000)) {
        order = null;
      }
    }

    if (orderError) {
      console.error("[CREATE CART XENDIT ORDER LOAD]", { orderId, code: orderError.code ?? null, message: orderError.message ?? null });
      return jsonResponse({ error: "Unable to load the order.", code: orderError.code ?? null, message: orderError.message ?? null }, 500);
    }
    if (!order) return jsonResponse({ error: "Order not found or you do not have access to it." }, 404);

    const paymentStatus = (order.payment_status ?? "").toLowerCase();
    const orderStatus = (order.order_status ?? "").toLowerCase();
    if (["paid", "verified", "payment_verified"].includes(paymentStatus)) return jsonResponse({ error: "This order is already paid." }, 400);
    if (["cancelled", "canceled", "rejected", "declined", "void", "refunded"].includes(orderStatus)) return jsonResponse({ error: "This order cannot be paid." }, 400);
    if (orderStatus !== "pending" || !["unpaid", "pending"].includes(paymentStatus)) return jsonResponse({ error: "This order is not eligible for payment yet." }, 400);

    const amount = Number(order.total);
    if (!Number.isFinite(amount) || amount <= 0) return jsonResponse({ error: "This order does not have a valid total." }, 400);
    const normalizedAmount = Math.round(amount * 100) / 100;
    const orderReference = safeName(order.order_number ?? order.id, order.id.replace(/[^a-zA-Z0-9]/g, ""));
    const referenceId = `SB${orderReference}FULL`.slice(0, 64);
    const appUrl = Deno.env.get("SWEET_BAKES_APP_URL");
    let appOrigin: string;
    try {
      const parsed = new URL(appUrl ?? "");
      if (parsed.protocol !== "https:") throw new Error("HTTPS required");
      appOrigin = parsed.origin;
    } catch {
      return jsonResponse({ error: "Payment return URL is not configured." }, 500);
    }

    const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
    if (!secretKey) return jsonResponse({ error: "Payment service is not configured." }, 500);
    const sessionPayload = {
      reference_id: referenceId,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: normalizedAmount,
      currency: "PHP",
      country: "PH",
      customer: {
        reference_id: `C${crypto.randomUUID().replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 64),
        type: "INDIVIDUAL",
        ...(order.email ? { email: order.email } : {}),
        individual_detail: { given_names: safeName(order.first_name, "SweetBakes"), surname: safeName(order.last_name, "Customer") },
      },
      items: [{ reference_id: `I${orderReference}`.slice(0, 64), name: "Sweet Bakes order", type: "PHYSICAL_SERVICE", net_unit_amount: normalizedAmount, quantity: 1, currency: "PHP", category: "BAKERY", description: `Payment for order ${order.order_number ?? order.id}`.slice(0, 255) }],
      capture_method: "AUTOMATIC",
      locale: "en",
      description: `Sweet Bakes payment for order ${order.order_number ?? order.id}`.slice(0, 255),
      success_return_url: user
        ? `${appOrigin}/my-orders?payment=success&order=${encodeURIComponent(order.id)}`
        : `${appOrigin}/cart?payment=success`,
      cancel_return_url: user
        ? `${appOrigin}/my-orders?payment=cancelled&order=${encodeURIComponent(order.id)}`
        : `${appOrigin}/cart?payment=cancelled`,
    };

    let response: Response;
    try {
      response = await fetch(XENDIT_SESSIONS_URL, {
        method: "POST",
        headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}`, "Content-Type": "application/json" },
        body: JSON.stringify(sessionPayload),
      });
    } catch {
      return jsonResponse({ error: "Unable to reach the payment service." }, 502);
    }
    const responseText = await response.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(responseText) as Record<string, unknown>; } catch { /* provider returned non-JSON */ }
    if (!response.ok) {
      console.error("[CREATE CART XENDIT SESSION ERROR]", { status: response.status, error_code: body.error_code ?? null, message: body.message ?? null });
      return jsonResponse({ error: "Payment service rejected the payment request.", error_code: body.error_code ?? null, message: body.message ?? null }, 502);
    }
    if (typeof body.payment_link_url !== "string") return jsonResponse({ error: "Payment service returned no checkout URL." }, 502);
    return jsonResponse({ paymentId: body.payment_id ?? body.payment_session_id ?? null, referenceId: body.reference_id ?? referenceId, status: body.status ?? "ACTIVE", paymentUrl: body.payment_link_url });
  }),
};
