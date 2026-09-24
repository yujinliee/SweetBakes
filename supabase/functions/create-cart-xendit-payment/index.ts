import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

const XENDIT_SESSIONS_URL = "https://api.xendit.co/sessions";
const XENDIT_CANCEL_SESSION_URL = (id: string) => `https://api.xendit.co/sessions/${encodeURIComponent(id)}/cancel`;
const DEPLOYED_ORIGIN = "https://sweetbakes-ten.vercel.app";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": DEPLOYED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const isLocalhost = /^https?:\/\/localhost(?::\d+)?$/.test(origin);
  return {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": origin === DEPLOYED_ORIGIN || isLocalhost ? origin : DEPLOYED_ORIGIN,
  };
}

type Order = {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  total: number | string | null;
  xendit_payment_session_id: string | null;
  subtotal: number | string | null;
  delivery_fee: number | string | null;
  payment_status: string | null;
  order_status: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? corsHeaders(req) : CORS_HEADERS), "Content-Type": "application/json" },
  });
}

function safeName(value: string | null, fallback: string) {
  const cleaned = (value ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return cleaned || fallback;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    console.log("[CREATE CART XENDIT ENTRY]", {
      method: req.method,
      origin: req.headers.get("origin"),
      hasContext: Boolean(ctx),
    });
    if (req.method === "OPTIONS") {
      return new Response("ok", { status: 200, headers: corsHeaders(req) });
    }
    const respond = (body: Record<string, unknown>, status = 200) => jsonResponse(body, status, req);
    if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

    const authorization = req.headers.get("Authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return respond({ error: "Authentication service is not configured." }, 500);

    let user: { id: string } | null = null;
    let customerSupabase: ReturnType<typeof createClient> | null = null;
    if (authorization) {
      if (!authorization.match(/^Bearer\s+\S+$/i)) return respond({ error: "Invalid authorization header." }, 401);
      customerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization } },
      });
      const { data: userData, error: userError } = await customerSupabase.auth.getUser();
      if (userError || !userData?.user) return respond({ error: "Authentication is invalid." }, 401);
      user = userData.user;
    }

    let input: unknown;
    try { input = await req.json(); } catch { return respond({ error: "Request body must be valid JSON." }, 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || typeof (input as { orderId?: unknown }).orderId !== "string" || !(input as { orderId: string }).orderId.trim()) {
      return respond({ error: "A non-empty orderId is required." }, 400);
    }

    const request = input as { orderId: string; guestEmail?: unknown; statusOnly?: unknown; appliedVoucher?: unknown; voucher_applied?: unknown };
    const orderId = request.orderId.trim();
    let order: Order | null = null;
    let orderError: { message?: string; code?: string } | null = null;
    if (user) {
      customerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: authorization as string } },
      });
      const result = await customerSupabase
        .from("orders")
        .select("id, order_number, customer_id, email, first_name, last_name, created_at, subtotal, delivery_fee, total, payment_status, order_status, xendit_payment_session_id")
        .eq("id", orderId)
        .eq("customer_id", user.id)
        .maybeSingle() as { data: Order | null; error: { message?: string; code?: string } | null };
      order = result.data;
      orderError = result.error;
    } else {
      if (typeof request.guestEmail !== "string" || !request.guestEmail.trim()) {
        return respond({ error: "A guest checkout email is required." }, 400);
      }
      const result = await ctx.supabaseAdmin
        .from("orders")
        .select("id, order_number, customer_id, email, first_name, last_name, created_at, subtotal, delivery_fee, total, payment_status, order_status, xendit_payment_session_id")
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
      return respond({ error: "Unable to load the order.", code: orderError.code ?? null, message: orderError.message ?? null }, 500);
    }
    if (!order) return respond({ error: "Order not found or you do not have access to it." }, 404);

    const paymentStatus = (order.payment_status ?? "").toLowerCase();
    const orderStatus = (order.order_status ?? "").toLowerCase();
    if (request.statusOnly === true) {
      return respond({ orderId: order.id, orderNumber: order.order_number, customerId: order.customer_id, paymentStatus });
    }
    if (["paid", "verified", "payment_verified"].includes(paymentStatus)) return respond({ error: "This order is already paid." }, 400);
    if (["cancelled", "canceled", "rejected", "declined", "void", "refunded"].includes(orderStatus)) return respond({ error: "This order cannot be paid." }, 400);
    if (orderStatus !== "pending" || !["unpaid", "pending"].includes(paymentStatus)) return respond({ error: "This order is not eligible for payment yet." }, 400);

    const clientWantsVoucher = Boolean(user && (request.appliedVoucher === true || request.voucher_applied === true));
    let amount = Number(order.total);
    let discountAmount = 0;
    let rewardApplied = false;
    let rewardId: string | null = null;
    if (clientWantsVoucher) {
      const { data: reservation, error } = await customerSupabase!.rpc("reserve_customer_loyalty_reward", { p_order_id: order.id }) as { data: { reward_reserved?: boolean; reward_id?: string | null; final_amount?: number | string; discount_amount?: number | string } | null; error: { message?: string } | null };
      if (error || !reservation) return respond({ error: "Unable to prepare the loyalty reward reservation." }, 500);
      rewardApplied = reservation.reward_reserved === true;
      rewardId = reservation.reward_id ?? null;
      amount = Number(reservation.final_amount ?? amount);
      discountAmount = Number(reservation.discount_amount ?? 0);
    }
    if (!Number.isFinite(amount) || amount <= 0) return respond({ error: "This order does not have a valid total." }, 400);
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
      return respond({ error: "Payment return URL is not configured." }, 500);
    }

    const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
    if (!secretKey) return respond({ error: "Payment service is not configured." }, 500);
    const existingSessionId = order.xendit_payment_session_id;
    if (existingSessionId) {
      const existing = await fetch(`https://api.xendit.co/sessions/${encodeURIComponent(existingSessionId)}`, { headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` } }).catch(() => null);
      if (!existing?.ok) return respond({ error: "Unable to reconcile the existing payment session before retrying." }, 502);
      const existingBody = await existing.json() as Record<string, unknown>;
      const existingStatus = typeof existingBody.status === "string" ? existingBody.status.toUpperCase() : "UNKNOWN";
      const existingAmount = Number(existingBody.amount);
      if (existingStatus === "COMPLETED") {
        if (existingAmount !== normalizedAmount || existingBody.reference_id !== referenceId) return respond({ error: "The existing payment session does not match this order." }, 409);
        if (rewardApplied && rewardId) {
          const { error } = await ctx.supabaseAdmin.rpc("complete_customer_loyalty_payment", { p_order_id: order.id, p_session_id: existingSessionId, p_amount: existingAmount });
          if (error) return respond({ error: "Payment completed but reconciliation is still pending." }, 409);
        } else {
          const { error } = await ctx.supabaseAdmin.from("orders").update({ payment_status: "paid", amount_paid: existingAmount, updated_at: new Date().toISOString() }).eq("id", order.id).eq("payment_status", "unpaid");
          if (error) return respond({ error: "Payment completed but reconciliation is still pending." }, 409);
        }
        return respond({ error: "This order is already paid.", reconciled: true }, 400);
      }
      if (existingStatus === "ACTIVE") {
        if (existingAmount !== normalizedAmount || existingBody.reference_id !== referenceId || typeof existingBody.payment_link_url !== "string") return respond({ error: "The existing payment session does not match this order." }, 409);
        return respond({ paymentId: existingBody.payment_id ?? existingSessionId, referenceId, status: existingBody.status, paymentUrl: existingBody.payment_link_url, amount: normalizedAmount, discountAmount, rewardApplied });
      }
      if (!["EXPIRED", "CANCELED", "CANCELLED"].includes(existingStatus)) return respond({ error: "Payment reconciliation is pending. Please try again after provider status is available." }, 409);
      if (rewardId) {
        const { error } = await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", { p_order_id: order.id, p_session_id: existingSessionId });
        if (error) return respond({ error: "Unable to release the expired payment reservation safely." }, 409);
      } else {
        const { error } = await ctx.supabaseAdmin.from("orders").update({ xendit_payment_session_id: null }).eq("id", order.id).eq("xendit_payment_session_id", existingSessionId);
        if (error) return respond({ error: "Unable to release the expired payment session safely." }, 409);
      }
    }
    if (rewardId) {
      const { data: activeReservation, error: activeReservationError } = await customerSupabase!.rpc("get_customer_loyalty_reservation", { p_order_id: order.id }) as { data: { reserved?: boolean; session_id?: string | null } | null; error: { message?: string } | null };
      if (activeReservationError) return respond({ error: "Unable to verify the active payment reservation." }, 500);
      if (activeReservation?.reserved && activeReservation.session_id) {
        const existing = await fetch(`https://api.xendit.co/sessions/${encodeURIComponent(activeReservation.session_id)}`, { headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` } }).catch(() => null);
        if (!existing?.ok) return respond({ error: "Unable to resume the active payment session." }, 502);
        const existingBody = await existing.json() as Record<string, unknown>;
        if (typeof existingBody.payment_link_url !== "string") return respond({ error: "The active payment session has no checkout URL." }, 502);
        return respond({ paymentId: existingBody.payment_id ?? activeReservation.session_id, referenceId: existingBody.reference_id ?? referenceId, status: existingBody.status ?? "ACTIVE", paymentUrl: existingBody.payment_link_url, amount: Math.round(amount * 100) / 100, discountAmount: Math.round(discountAmount * 100) / 100, rewardApplied: true });
      }
    }
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
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
      return respond({ error: "Unable to reach the payment service." }, 502);
    }
    const responseText = await response.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(responseText) as Record<string, unknown>; } catch { /* provider returned non-JSON */ }
    if (!response.ok) {
      console.error("[CREATE CART XENDIT SESSION ERROR]", { status: response.status, error_code: body.error_code ?? null, message: body.message ?? null });
      if (rewardId) await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", { p_order_id: order.id, p_session_id: null });
      return respond({ error: "Payment service rejected the payment request.", error_code: body.error_code ?? null, message: body.message ?? null }, 502);
    }
    const sessionId = typeof body.payment_session_id === "string" ? body.payment_session_id : null;
    const expiresAt = typeof body.expires_at === "string" ? body.expires_at : null;
    if (typeof body.payment_link_url !== "string" || (rewardId && (!sessionId || !expiresAt))) {
      if (rewardId && sessionId) await fetch(XENDIT_CANCEL_SESSION_URL(sessionId), { method: "POST", headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` } }).catch(() => undefined);
      if (rewardId) await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", { p_order_id: order.id, p_session_id: null });
      return respond({ error: "Payment service returned an incomplete checkout session." }, 502);
    }
    if (sessionId) {
      const { error } = await ctx.supabaseAdmin.from("orders").update({ xendit_payment_session_id: sessionId }).eq("id", order.id).eq("payment_status", "unpaid");
      if (error) {
        await fetch(XENDIT_CANCEL_SESSION_URL(sessionId), { method: "POST", headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` } }).catch(() => undefined);
        if (rewardId) await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", { p_order_id: order.id, p_session_id: null });
        return respond({ error: "Unable to safely persist the payment session." }, 502);
      }
    }
    if (rewardId) {
      const { error } = await ctx.supabaseAdmin.rpc("bind_customer_loyalty_reservation_expiry", { p_order_id: order.id, p_reward_id: rewardId, p_session_id: sessionId, p_expires_at: new Date(Date.parse(expiresAt)).toISOString() });
      if (error) {
        await fetch(XENDIT_CANCEL_SESSION_URL(sessionId), { method: "POST", headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` } }).catch(() => undefined);
        await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", { p_order_id: order.id, p_session_id: null });
        return respond({ error: "Unable to safely finalize the payment reservation." }, 502);
      }
    }
    return respond({ paymentId: body.payment_id ?? body.payment_session_id ?? null, referenceId: body.reference_id ?? referenceId, status: body.status ?? "ACTIVE", paymentUrl: body.payment_link_url, amount: Math.round(amount * 100) / 100, discountAmount: rewardApplied ? Math.round(discountAmount * 100) / 100 : 0, rewardApplied });
  }),
};
