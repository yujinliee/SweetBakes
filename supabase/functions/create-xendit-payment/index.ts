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
  required_down_payment: number | string | null;
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

function alphanumeric(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned || fallback;
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    console.log("[CREATE XENDIT ENTRY]", {
      hasAuthorizationHeader: Boolean(req.headers.get("Authorization")),
    });

    const authorization = req.headers.get("Authorization");
    const hasAuthorizationHeader = Boolean(authorization);
    if (!authorization?.match(/^Bearer\s+\S+$/i)) {
      console.log("[CREATE XENDIT PAYMENT AUTH]", {
        hasAuthorizationHeader,
        hasUser: false,
        userId: null,
        authError: "Missing or invalid Authorization header",
      });
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[CREATE XENDIT PAYMENT AUTH] Supabase public auth configuration is missing");
      return jsonResponse({ error: "Authentication service is not configured." }, 500);
    }

    const customerSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await customerSupabase.auth.getUser();
    const user = userData?.user;
    console.log("[CREATE XENDIT PAYMENT AUTH]", {
      hasAuthorizationHeader,
      hasUser: Boolean(user),
      userId: user?.id ?? null,
      authError: userError?.message ?? null,
    });
    if (userError || !user) {
      return jsonResponse({ error: "Authentication is required." }, 401);
    }

    let input: unknown;
    try {
      input = await req.json();
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }

    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      !("orderId" in input) ||
      typeof (input as { orderId?: unknown }).orderId !== "string" ||
      !(input as { orderId: string }).orderId.trim()
    ) {
      return jsonResponse({ error: "A non-empty orderId is required." }, 400);
    }

    const request = input as { orderId: string; paymentType?: unknown };
    const orderId = request.orderId.trim();
    const paymentType = request.paymentType === "regular" ? "regular" : "custom_down_payment";
    const { data: order, error: orderError } = await customerSupabase
      .from("orders")
      .select(
        "id, order_number, customer_id, email, first_name, last_name, required_down_payment, total, payment_status, order_status",
      )
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle() as {
        data: Order | null;
        error: { code?: string; message?: string; details?: string; hint?: string } | null;
      };

    if (orderError) {
      console.error("[CREATE XENDIT ORDER LOAD]", {
        orderId,
        userId: user?.id ?? null,
        code: orderError.code ?? null,
        message: orderError.message ?? null,
        details: orderError.details ?? null,
        hint: orderError.hint ?? null,
      });
      return jsonResponse({ error: "Unable to load the order." }, 500);
    }
    if (!order) {
      const { data: existingOrder, error: ownershipError } = await ctx.supabaseAdmin
        .from("orders")
        .select("id, customer_id")
        .eq("id", orderId)
        .maybeSingle() as {
          data: { id: string; customer_id: string | null } | null;
          error: { code?: string; message?: string; details?: string; hint?: string } | null;
        };
      if (ownershipError) {
        console.error("[CREATE XENDIT ORDER LOAD]", {
          orderId,
          userId: user?.id ?? null,
          code: ownershipError.code ?? null,
          message: ownershipError.message ?? null,
          details: ownershipError.details ?? null,
          hint: ownershipError.hint ?? null,
        });
        return jsonResponse({ error: "Unable to verify the order." }, 500);
      }
      if (existingOrder && existingOrder.customer_id !== user.id) {
        return jsonResponse({ error: "You do not have access to this order." }, 403);
      }
      return jsonResponse({ error: "Order not found." }, 404);
    }
    if (order.customer_id !== user.id) {
      return jsonResponse({ error: "You do not have access to this order." }, 403);
    }

    const isPaid = ["paid", "verified", "payment_verified"].includes(order.payment_status ?? "");
    if (isPaid) {
      return jsonResponse({ error: paymentType === "regular" ? "This order is already paid." : "This order's down payment is already paid." }, 400);
    }

    if (paymentType === "regular") {
      if (order.order_status !== "pending" || !["unpaid", "pending"].includes(order.payment_status ?? "")) {
        return jsonResponse({ error: "This order is not eligible for payment yet." }, 400);
      }
    } else if (order.order_status !== "confirmed" || order.payment_status !== "pending") {
      return jsonResponse({ error: "This order is not eligible for a down payment yet." }, 400);
    }

    const amount = Number(paymentType === "regular" ? order.total : order.required_down_payment);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: paymentType === "regular" ? "This order does not have a valid total." : "This order does not have a valid required down payment." }, 400);
    }
    const normalizedAmount = Math.round(amount * 100) / 100;

    const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
    if (!secretKey) {
      console.error("[XENDIT] XENDIT_SECRET_KEY is not configured");
      return jsonResponse({ error: "Payment service is not configured." }, 500);
    }

    const orderReference = alphanumeric(
      order.order_number ?? order.id,
      order.id.replace(/[^a-zA-Z0-9]/g, ""),
    );
    const referenceId = `SB${orderReference}${paymentType === "regular" ? "FULL" : "DP"}`.slice(0, 64);
    const givenNames = alphanumeric(order.first_name ?? "Sweet Bakes", "SweetBakes").slice(0, 255);
    const surname = alphanumeric(order.last_name ?? "Customer", "Customer").slice(0, 255);
    const customerReferenceId = `C${crypto.randomUUID().replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 64);

    const appUrl = Deno.env.get("SWEET_BAKES_APP_URL") ?? Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL");
    let returnUrls: { success_return_url?: string; cancel_return_url?: string } = {};
    if (appUrl) {
      try {
        const parsedAppUrl = new URL(appUrl);
        if (parsedAppUrl.protocol === "https:") {
          const returnBase = `${parsedAppUrl.origin}/my-orders`;
          returnUrls = {
            success_return_url: `${returnBase}?payment=success&order=${encodeURIComponent(order.id)}`,
            cancel_return_url: `${returnBase}?payment=cancelled&order=${encodeURIComponent(order.id)}`,
          };
        }
      } catch {
        console.error("[XENDIT] configured app URL is invalid");
      }
    }

    if (!returnUrls.success_return_url || !returnUrls.cancel_return_url) {
      console.error("[XENDIT] payment return URL is not configured with a valid HTTPS app URL");
      return jsonResponse({ error: "Payment return URL is not configured." }, 500);
    }

    const sessionPayload = {
      reference_id: referenceId,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: normalizedAmount,
      currency: "PHP",
      country: "PH",
      customer: {
        reference_id: customerReferenceId,
        type: "INDIVIDUAL",
        ...(order.email ? { email: order.email } : {}),
        individual_detail: { given_names: givenNames, surname },
      },
      items: [
        {
          reference_id: `I${orderReference}`.slice(0, 64),
          name: paymentType === "regular" ? "Sweet Bakes order" : "Sweet Bakes down payment",
          type: "PHYSICAL_SERVICE",
          net_unit_amount: normalizedAmount,
          quantity: 1,
          currency: "PHP",
          category: "BAKERY",
          description: `${paymentType === "regular" ? "Payment for" : "Down payment for"} order ${order.order_number ?? order.id}`.slice(0, 255),
        },
      ],
      capture_method: "AUTOMATIC",
      locale: "en",
      description: `Sweet Bakes ${paymentType === "regular" ? "payment" : "down payment"} for order ${order.order_number ?? order.id}`.slice(0, 255),
      ...returnUrls,
    };

    let xenditResponse: Response;
    try {
      xenditResponse = await fetch(XENDIT_SESSIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${secretKey}:`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionPayload),
      });
    } catch {
      return jsonResponse({ error: "Unable to reach the payment service." }, 502);
    }

    const responseText = await xenditResponse.text();
    let xenditErrorBody: Record<string, unknown> = {};
    try {
      xenditErrorBody = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      // Keep provider response details private.
    }

    if (!xenditResponse.ok) {
      console.error("[XENDIT SESSION ERROR]", {
        status: xenditResponse.status,
        statusText: xenditResponse.statusText,
        body: xenditErrorBody,
      });
      return jsonResponse({
        error: "Payment service rejected the payment request.",
        error_code: xenditErrorBody.error_code ?? null,
        message: xenditErrorBody.message ?? null,
        validation_errors: xenditErrorBody.errors ?? xenditErrorBody.validation_errors ?? null,
      }, 502);
    }

    const paymentUrl = typeof xenditErrorBody.payment_link_url === "string"
      ? xenditErrorBody.payment_link_url
      : null;
    if (!paymentUrl) {
      console.error("[XENDIT] session response did not include payment_link_url");
      return jsonResponse({ error: "Payment service returned no checkout URL." }, 502);
    }

    return jsonResponse({
      paymentId: xenditErrorBody.payment_id ?? xenditErrorBody.payment_session_id ?? null,
      referenceId: xenditErrorBody.reference_id ?? referenceId,
      status: xenditErrorBody.status ?? "ACTIVE",
      paymentUrl,
    });
  }),
};
