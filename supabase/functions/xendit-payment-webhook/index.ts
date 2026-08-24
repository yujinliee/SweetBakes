import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

const COMPLETED_EVENT = "payment_session.completed";
const EXPIRED_EVENT = "payment_session.expired";

type SessionData = {
  payment_session_id?: unknown;
  payment_id?: unknown;
  reference_id?: unknown;
  status?: unknown;
  currency?: unknown;
  amount?: unknown;
  session_type?: unknown;
  mode?: unknown;
};

type Order = {
  id: string;
  order_number: string | null;
  required_down_payment: number | string | null;
  payment_status: string | null;
  order_status: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function alphanumeric(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned || fallback;
}

function referenceForOrder(order: Pick<Order, "id" | "order_number">) {
  return `SB${alphanumeric(order.order_number ?? order.id, order.id.replace(/[^a-zA-Z0-9]/g, ""))}DP`.slice(0, 64);
}

function getNamedSecretKey() {
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!rawSecretKeys) return null;
  try {
    const parsed = JSON.parse(rawSecretKeys) as unknown;
    if (parsed && typeof parsed === "object") {
      const value = Object.values(parsed as Record<string, unknown>)
        .find((entry) => typeof entry === "string" && entry.length > 0);
      return typeof value === "string" ? value : null;
    }
  } catch {
    // Ignore malformed optional secret-key metadata and use fallbacks.
  }
  return null;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const expectedToken = Deno.env.get("XENDIT_WEBHOOK_TOKEN");
    if (!expectedToken) {
      console.error("[XENDIT WEBHOOK] XENDIT_WEBHOOK_TOKEN is not configured");
      return jsonResponse({ error: "Webhook verification is not configured." }, 500);
    }

    const receivedToken = req.headers.get("x-callback-token");
    if (!receivedToken || receivedToken !== expectedToken) {
      return jsonResponse({ error: "Unauthorized webhook." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const legacyServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseSecretKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? getNamedSecretKey() ?? legacyServiceRoleKey;
    console.log("[XENDIT WEBHOOK DB CONFIG]", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSecretKey: Boolean(supabaseSecretKey),
      hasLegacyServiceRole: Boolean(legacyServiceRoleKey),
    });
    if (!supabaseUrl || !supabaseSecretKey) {
      console.error("[XENDIT WEBHOOK] Supabase privileged database configuration is missing");
      return jsonResponse({ error: "Server database credentials are not configured." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse({ error: "Webhook payload must be an object." }, 400);
    }

    const event = typeof (payload as { event?: unknown }).event === "string"
      ? (payload as { event: string }).event
      : "";
    const data = (payload as { data?: unknown }).data;
    const session = data && typeof data === "object" && !Array.isArray(data)
      ? data as SessionData
      : {};
    const referenceId = typeof session.reference_id === "string" ? session.reference_id : null;
    const paymentSessionId = typeof session.payment_session_id === "string" ? session.payment_session_id : null;
    const paymentId = typeof session.payment_id === "string" ? session.payment_id : null;

    console.log("[XENDIT WEBHOOK]", {
      event,
      referenceId,
      paymentSessionId,
      paymentId,
      amount: typeof session.amount === "number" ? session.amount : null,
    });

    if (event === EXPIRED_EVENT) {
      return jsonResponse({ received: true, result: "ignored_expired" });
    }
    if (event !== COMPLETED_EVENT) {
      return jsonResponse({ received: true, result: "ignored_event" });
    }

    const amount = Number(session.amount);
    const currency = typeof session.currency === "string" ? session.currency.toUpperCase() : "";
    const status = typeof session.status === "string" ? session.status.toUpperCase() : "";
    const sessionType = typeof session.session_type === "string" ? session.session_type.toUpperCase() : "";
    const mode = typeof session.mode === "string" ? session.mode.toUpperCase() : "";

    if (!referenceId || !Number.isFinite(amount) || currency !== "PHP" || status !== "COMPLETED" || sessionType !== "PAY" || mode !== "PAYMENT_LINK") {
      console.error("[XENDIT WEBHOOK] completed event failed validation", {
        event,
        referenceId,
        paymentSessionId,
        paymentId,
        amount: Number.isFinite(amount) ? amount : null,
        currency,
        status,
        sessionType,
        mode,
      });
      return jsonResponse({ error: "Invalid completed payment session payload." }, 400);
    }

    const { data: orders, error: orderLookupError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, required_down_payment, payment_status, order_status") as {
        data: Order[] | null;
        error: { code?: string; message?: string; details?: string; hint?: string } | null;
      };

    if (orderLookupError) {
      console.error("[XENDIT WEBHOOK] order lookup failed", {
        code: orderLookupError.code ?? null,
        message: orderLookupError.message ?? null,
        details: orderLookupError.details ?? null,
        hint: orderLookupError.hint ?? null,
      });
      return jsonResponse({ error: "Unable to load the order." }, 500);
    }

    const order = (orders ?? []).find((candidate) => referenceForOrder(candidate) === referenceId) ?? null;
    if (!order) {
      return jsonResponse({ received: true, result: "ignored_unknown_reference" });
    }

    const requiredDownPayment = Number(order.required_down_payment);
    if (!Number.isFinite(requiredDownPayment) || Math.round(requiredDownPayment * 100) !== Math.round(amount * 100)) {
      console.error("[XENDIT WEBHOOK] amount mismatch", {
        event,
        referenceId,
        orderId: order.id,
        amount,
      });
      return jsonResponse({ error: "Payment amount does not match the order." }, 400);
    }

    if (order.payment_status === "paid") {
      return jsonResponse({ received: true, result: "already_processed", orderId: order.id });
    }
    if (order.order_status !== "confirmed" || order.payment_status !== "pending") {
      return jsonResponse({ received: true, result: "ignored_order_state", orderId: order.id });
    }

    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("order_status", "confirmed")
      .eq("payment_status", "pending");

    if (updateError) {
      console.error("[XENDIT WEBHOOK] order update failed", {
        code: updateError.code ?? null,
        message: updateError.message ?? null,
        details: updateError.details ?? null,
        hint: updateError.hint ?? null,
      });
      return jsonResponse({ error: "Unable to update the order." }, 500);
    }

    console.log("[XENDIT WEBHOOK] payment verified", {
      event,
      referenceId,
      orderId: order.id,
      paymentSessionId,
      paymentId,
      amount,
      currentPaymentStatus: order.payment_status,
      updateResult: "payment_status_paid",
      result: "payment_status_paid",
    });
    return jsonResponse({ received: true, result: "payment_verified", orderId: order.id });
  }),
};
