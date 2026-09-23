import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

const XENDIT_SESSIONS_URL = "https://api.xendit.co/sessions";
const XENDIT_CANCEL_SESSION_URL = (sessionId: string) => `https://api.xendit.co/sessions/${encodeURIComponent(sessionId)}/cancel`;
const LOYALTY_DOWN_PAYMENT_PERCENT = 20;
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
  amount_paid: number | string | null;
  loyalty_reward_applied: boolean | null;
  loyalty_discount_percent: number | string | null;
  loyalty_discount_amount: number | string | null;
  payment_amount_due: number | string | null;
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

// Round to two decimals so PHP cent values are exact and stable.
function toMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function isValidOrderId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

    let input: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return jsonResponse({ error: "Request body must be a JSON object." }, 400);
      }
      input = raw as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Request body must be valid JSON." }, 400);
    }

    const orderId = isValidOrderId(input.orderId)
      ? input.orderId.trim()
      : isValidOrderId(input.order_id)
        ? input.order_id.trim()
        : "";
    if (!orderId) {
      return jsonResponse({ error: "A non-empty orderId is required." }, 400);
    }

    const paymentType = input.paymentType === "regular" ? "regular" : "custom_down_payment";
    const clientWantsVoucher = paymentType === "custom_down_payment" &&
      (input.appliedVoucher === true || input.voucher_applied === true);
    const clientAmount = Number(input.amount);
    const clientProvidedAmount = Number.isFinite(clientAmount) && clientAmount > 0;

    console.log("[XENDIT DOWNPAYMENT REQUEST]", {
      orderId,
      paymentPurpose: paymentType,
      clientWantsVoucher,
      clientProvidedAmount,
      clientAmount: clientProvidedAmount ? clientAmount : null,
    });

    const { data: order, error: orderError } = await customerSupabase
      .from("orders")
      .select(
        "id, order_number, customer_id, email, first_name, last_name, required_down_payment, total, payment_status, order_status, amount_paid, loyalty_reward_applied, loyalty_discount_percent, loyalty_discount_amount, payment_amount_due",
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

    const rawAmount = paymentType === "regular" ? order.total : order.required_down_payment;
    const normalizedAmount = toMoney(rawAmount);
    if (normalizedAmount <= 0) {
      return jsonResponse({ error: paymentType === "regular" ? "This order does not have a valid total." : "This order does not have a valid required down payment." }, 400);
    }

    // ── Backend-authoritative loyalty reservation ──────────────────────────
    // The client flag expresses intent only. Eligibility, cycle ownership,
    // amount, and reservation state are decided by the database RPC.
    let voucherUsed = false;
    let voucherDiscountAmount = 0;
    let finalAmount = normalizedAmount;
    let reservedRewardId: string | null = null;

    if (clientWantsVoucher) {
      const { data: reservation, error: reservationError } = await customerSupabase.rpc(
        "reserve_customer_loyalty_reward",
        { p_order_id: order.id },
      ) as {
        data: {
          reward_reserved?: boolean;
          reward_id?: string | null;
          discount_amount?: number | string;
          final_amount?: number | string;
        } | null;
        error: { code?: string; message?: string } | null;
      };
      if (reservationError || !reservation) {
        console.error("[CREATE XENDIT PAYMENT] loyalty reservation failed", {
          orderId,
          userId: user.id,
          code: reservationError?.code ?? null,
          message: reservationError?.message ?? null,
        });
        return jsonResponse({ error: "Unable to prepare the loyalty reward reservation." }, 500);
      }
      voucherUsed = reservation.reward_reserved === true;
      reservedRewardId = voucherUsed ? reservation.reward_id ?? null : null;
      if (voucherUsed && !reservedRewardId) {
        return jsonResponse({ error: "Unable to identify the loyalty reward reservation." }, 500);
      }
      voucherDiscountAmount = voucherUsed ? toMoney(reservation.discount_amount) : 0;
      finalAmount = voucherUsed ? toMoney(reservation.final_amount) : normalizedAmount;
    }

    // Client-tamper guard: the charged amount is always computed here. If the
    // client supplied an amount that does not match the server calculation,
    // reject it instead of charging a different value.
    if (clientProvidedAmount && Math.abs(clientAmount - finalAmount) > 0.009) {
      console.log("[XENDIT AMOUNT MISMATCH]", {
        orderId,
        paymentPurpose: paymentType,
        clientAmount,
        serverAmount: finalAmount,
        originalDownPayment: normalizedAmount,
        voucherUsed,
      });
      if (reservedRewardId) {
        await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", {
          p_order_id: order.id,
          p_session_id: null,
        });
      }
      return jsonResponse({
        error: "Payment amount does not match the calculated amount.",
        expected_amount: finalAmount,
      }, 400);
    }

    if (voucherUsed && finalAmount <= 0) {
      return jsonResponse({ error: "The voucher discount makes the down payment amount invalid." }, 400);
    }

    // ── Persist the authoritative payable before opening the payment session ──
    // Guards against races: the update only applies while the order is still in
    // the exact state required to pay. If zero rows matched, the state changed.
    const dueUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (paymentType === "custom_down_payment") {
      dueUpdate.payment_amount_due = finalAmount;
      dueUpdate.loyalty_reward_applied = voucherUsed;
      dueUpdate.loyalty_discount_percent = voucherUsed ? LOYALTY_DOWN_PAYMENT_PERCENT : 0;
      dueUpdate.loyalty_discount_amount = voucherUsed ? voucherDiscountAmount : 0;
    }

    let persistQuery = ctx.supabaseAdmin
      .from("orders")
      .update(dueUpdate)
      .eq("id", order.id)
      .select("id");
    persistQuery = paymentType === "regular"
      ? persistQuery.eq("order_status", "pending").in("payment_status", ["unpaid", "pending"])
      : persistQuery.eq("order_status", "confirmed").eq("payment_status", "pending");
    const { data: persisted, error: persistError } = await persistQuery
      .maybeSingle() as { data: { id: string } | null; error: { code?: string; message?: string } | null };

    if (persistError) {
      console.error("[CREATE XENDIT PAYMENT] persist payable failed", {
        orderId,
        code: persistError.code ?? null,
        message: persistError.message ?? null,
      });
      return jsonResponse({ error: "Unable to prepare the payment amount." }, 500);
    }
    if (!persisted) {
      return jsonResponse({ error: "The order is no longer payable in its current state. Please refresh." }, 409);
    }

    const secretKey = Deno.env.get("XENDIT_SECRET_KEY");
    if (!secretKey) {
      console.error("[XENDIT] XENDIT_SECRET_KEY is not configured");
      return jsonResponse({ error: "Payment service is not configured." }, 500);
    }

    if (voucherUsed) {
      const { data: existingReservation, error: existingReservationError } = await customerSupabase.rpc(
        "get_customer_loyalty_reservation",
        { p_order_id: order.id },
      ) as {
        data: { reserved?: boolean; session_id?: string | null; reservation_expires_at?: string | null } | null;
        error: { message?: string } | null;
      };
      if (existingReservationError) {
        return jsonResponse({ error: "Unable to verify the active payment reservation." }, 500);
      }
      if (existingReservation?.reserved && existingReservation.session_id) {
        const existingSessionResponse = await fetch(`https://api.xendit.co/sessions/${encodeURIComponent(existingReservation.session_id)}`, {
          headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` },
        }).catch(() => null);
        if (!existingSessionResponse?.ok) {
          return jsonResponse({ error: "Unable to resume the active payment session." }, 502);
        }
        const existingSession = await existingSessionResponse.json() as Record<string, unknown>;
        const existingPaymentUrl = typeof existingSession.payment_link_url === "string" ? existingSession.payment_link_url : null;
        if (!existingPaymentUrl) {
          return jsonResponse({ error: "The active payment session has no checkout URL." }, 502);
        }
        return jsonResponse({
          paymentId: existingSession.payment_id ?? existingSession.payment_session_id ?? existingReservation.session_id,
          referenceId: existingSession.reference_id ?? null,
          status: existingSession.status ?? "ACTIVE",
          paymentUrl: existingPaymentUrl,
          amount: finalAmount,
          originalDownPayment: normalizedAmount,
          discountAmount: voucherDiscountAmount,
          rewardApplied: true,
        });
      }
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

    console.log("[XENDIT DOWNPAYMENT PAYLOAD]", {
      orderId,
      paymentPurpose: paymentType,
      originalDownPayment: normalizedAmount,
      discountAmount: voucherDiscountAmount,
      payableAmount: finalAmount,
      rewardApplied: voucherUsed,
      referenceId,
    });

    const sessionPayload = {
      reference_id: referenceId,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: finalAmount,
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
          name: paymentType === "regular" ? "Sweet Bakes order" : voucherUsed ? "Sweet Bakes down payment (Loyalty Voucher)" : "Sweet Bakes down payment",
          type: "PHYSICAL_SERVICE",
          net_unit_amount: finalAmount,
          quantity: 1,
          currency: "PHP",
          category: "BAKERY",
          description: `${paymentType === "regular" ? "Payment for" : "Down payment for"} order ${order.order_number ?? order.id}${voucherUsed ? ` (20% loyalty voucher applied, -PHP ${voucherDiscountAmount.toFixed(2)})` : ""}`.slice(0, 255),
        },
      ],
      capture_method: "AUTOMATIC",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      locale: "en",
      description: `Sweet Bakes ${paymentType === "regular" ? "payment" : voucherUsed ? "down payment (loyalty voucher)" : "down payment"} for order ${order.order_number ?? order.id}`.slice(0, 255),
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
      if (reservedRewardId) {
        await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", {
          p_order_id: order.id,
          p_session_id: null,
        });
      }
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
      console.error("[XENDIT DOWNPAYMENT ERROR]", {
        orderId,
        paymentPurpose: paymentType,
        status: xenditResponse.status,
        code: xenditErrorBody.error_code ?? null,
        message: xenditErrorBody.message ?? null,
        validationErrors: xenditErrorBody.errors ?? xenditErrorBody.validation_errors ?? null,
      });
      if (reservedRewardId) {
        await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", {
          p_order_id: order.id,
          p_session_id: null,
        });
      }
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
    const paymentSessionId = typeof xenditErrorBody.payment_session_id === "string"
      ? xenditErrorBody.payment_session_id
      : null;
    const returnedExpiresAt = typeof xenditErrorBody.expires_at === "string"
      ? xenditErrorBody.expires_at
      : null;
    const returnedExpiryMs = returnedExpiresAt ? Date.parse(returnedExpiresAt) : NaN;
    if (!paymentUrl || (reservedRewardId && (!paymentSessionId || !Number.isFinite(returnedExpiryMs)))) {
      console.error("[XENDIT] session response did not include payment_link_url");
      if (reservedRewardId && paymentSessionId) {
        await fetch(XENDIT_CANCEL_SESSION_URL(paymentSessionId), {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` },
        }).catch(() => undefined);
      }
      if (reservedRewardId) {
        await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", {
          p_order_id: order.id,
          p_session_id: null,
        });
      }
      return jsonResponse({ error: "Payment service returned no checkout URL." }, 502);
    }

    if (reservedRewardId) {
      const { error: bindError } = await ctx.supabaseAdmin.rpc(
        "bind_customer_loyalty_reservation_expiry",
        {
          p_order_id: order.id,
          p_reward_id: reservedRewardId,
          p_session_id: paymentSessionId,
          p_expires_at: new Date(returnedExpiryMs).toISOString(),
        },
      );
      if (bindError) {
        console.error("[XENDIT] unable to bind returned session expiry", {
          orderId: order.id,
          rewardId: reservedRewardId,
          paymentSessionId,
          error: bindError.message ?? null,
        });
        const cancelResponse = await fetch(XENDIT_CANCEL_SESSION_URL(paymentSessionId), {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` },
        }).catch(() => null);
        if (cancelResponse?.ok) {
          await ctx.supabaseAdmin.rpc("release_customer_loyalty_reservation", {
            p_order_id: order.id,
            p_session_id: null,
          });
        }
        return jsonResponse({ error: "Unable to safely finalize the payment reservation." }, 502);
      }
    }

    return jsonResponse({
      paymentId: xenditErrorBody.payment_id ?? xenditErrorBody.payment_session_id ?? null,
      referenceId: xenditErrorBody.reference_id ?? referenceId,
      status: xenditErrorBody.status ?? "ACTIVE",
      paymentUrl,
      amount: finalAmount,
      originalDownPayment: paymentType === "regular" ? null : normalizedAmount,
      discountAmount: voucherUsed ? voucherDiscountAmount : 0,
      rewardApplied: voucherUsed,
    });
  }),
};
