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
  customer_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  order_method: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  total: number | string | null;
  required_down_payment: number | string | null;
  payment_status: string | null;
  order_status: string | null;
  amount_paid: number | string | null;
  loyalty_reward_applied: boolean | null;
  loyalty_discount_percent: number | string | null;
  loyalty_discount_amount: number | string | null;
  payment_amount_due: number | string | null;
  guest_confirmation_email_claimed_at: string | null;
  guest_confirmation_email_sent_at: string | null;
};

type OrderItem = {
  product_name: string | null;
  variant_name: string | null;
  quantity: number | null;
  unit_price: number | string | null;
  subtotal: number | string | null;
  customization_data: Record<string, unknown> | null;
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

function regularReferenceForOrder(order: Pick<Order, "id" | "order_number">) {
  return `SB${alphanumeric(order.order_number ?? order.id, order.id.replace(/[^a-zA-Z0-9]/g, ""))}FULL`.slice(0, 64);
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

// ─── Email helpers ────────────────────────────────────────────────────────────

function formatCurrency(value: number | string | null): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Not scheduled";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(value: string | null): string {
  if (!value) return "";
  const d = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatOrderMethod(value: string | null): string {
  const v = String(value ?? "").toLowerCase();
  if (v === "delivery") return "Delivery";
  if (v === "pickup") return "Store Pickup";
  return value ?? "—";
}

function safeCustomizationSummary(data: Record<string, unknown> | null): string {
  if (!data) return "";
  const parts: string[] = [];
  if (data.flavor && typeof data.flavor === "string") parts.push(`Flavor: ${data.flavor}`);
  if (data.size && typeof data.size === "string") parts.push(`Size: ${data.size}`);
  if (data.theme && typeof data.theme === "string") parts.push(`Theme: ${data.theme}`);
  if (data.cake_message && typeof data.cake_message === "string") parts.push(`Message: "${data.cake_message}"`);
  if (data.variant_name && typeof data.variant_name === "string") parts.push(data.variant_name);
  return parts.join(" · ");
}

function buildEmailHtml(order: Order, items: OrderItem[], trackUrl: string): string {
  const itemRows = items.map((item) => {
    const name = item.product_name ?? "Item";
    const variant = item.variant_name ? ` <span style="color:#806f67;font-size:12px;">(${item.variant_name})</span>` : "";
    const customSummary = safeCustomizationSummary(item.customization_data);
    const qty = item.quantity ?? 1;
    const price = formatCurrency(item.subtotal ?? (Number(item.unit_price ?? 0) * qty));
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0e8e3;vertical-align:top;">
          <strong style="color:#362a26;font-size:14px;">${name}</strong>${variant}
          ${customSummary ? `<br><span style="color:#806f67;font-size:12px;">${customSummary}</span>` : ""}
          <br><span style="color:#806f67;font-size:12px;">Qty: ${qty}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0e8e3;vertical-align:top;text-align:right;white-space:nowrap;">
          <strong style="color:#362a26;font-size:14px;">${price}</strong>
        </td>
      </tr>`;
  }).join("");

  const preferredTime = formatTime(order.preferred_time);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Sweet Bakes — Order Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#fffaf7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#362a26;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffaf7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #eadfd8;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#8d5fba;padding:28px 36px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.82);font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Sweet Bakes by:Rhona</p>
              <h1 style="margin:10px 0 0;color:#ffffff;font-size:26px;font-weight:500;line-height:1.2;">Order Confirmation</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">

              <p style="margin:0 0 24px;font-size:15px;color:#362a26;">
                Thank you for your order! We&rsquo;ve received your payment and your order is now being processed.
              </p>

              <!-- Order meta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#fffaf6;border:1px solid #eadfd8;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#8b7a73;font-weight:700;text-transform:uppercase;letter-spacing:.06em;width:50%;">Order ID</td>
                        <td style="padding:6px 0;font-size:14px;color:#362a26;font-weight:700;text-align:right;">${order.order_number ?? "—"}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#8b7a73;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Payment</td>
                        <td style="padding:6px 0;font-size:14px;color:#362a26;font-weight:700;text-align:right;">Paid</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#8b7a73;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Order Method</td>
                        <td style="padding:6px 0;font-size:14px;color:#362a26;font-weight:700;text-align:right;">${formatOrderMethod(order.order_method)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#8b7a73;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Preferred Date</td>
                        <td style="padding:6px 0;font-size:14px;color:#362a26;font-weight:700;text-align:right;">${formatDate(order.preferred_date)}</td>
                      </tr>
                      ${preferredTime ? `
                      <tr>
                        <td style="padding:6px 0;font-size:12px;color:#8b7a73;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Preferred Time</td>
                        <td style="padding:6px 0;font-size:14px;color:#362a26;font-weight:700;text-align:right;">${preferredTime}</td>
                      </tr>` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items -->
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#362a26;text-transform:uppercase;letter-spacing:.06em;">Order Summary</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                ${itemRows}
              </table>

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border-top:2px solid #eadfd8;padding-top:12px;">
                <tr>
                  <td style="padding-top:12px;font-size:15px;font-weight:700;color:#362a26;">Order Total</td>
                  <td style="padding-top:12px;font-size:16px;font-weight:700;color:#362a26;text-align:right;">${formatCurrency(order.total)}</td>
                </tr>
              </table>

              <!-- Track order note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#f4edfb;border:1px solid #d8c9e6;border-radius:8px;">
                <tr>
                  <td style="padding:16px 20px;font-size:13px;color:#362a26;line-height:1.6;">
                    <strong>Keep your Order ID.</strong> You&rsquo;ll need it together with your email address to track your order.
                    <br><br>
                    <strong>Order ID:</strong> ${order.order_number ?? "—"}
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${trackUrl}" style="display:inline-block;padding:13px 32px;background:#8d5fba;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:.02em;">Track Your Order</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9e8e87;line-height:1.6;text-align:center;">
                If you have any questions, reach us on Facebook or at <a href="mailto:rhonanarvaez@gmail.com" style="color:#8d5fba;">rhonanarvaez@gmail.com</a>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f7f2ef;padding:18px 36px;text-align:center;border-top:1px solid #eadfd8;">
              <p style="margin:0;font-size:11px;color:#9e8e87;">&copy; 2026 Sweet Bakes by:Rhona &middot; Diamond Village, Salawag, Dasmari&ntilde;as City</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendConfirmationEmail(
  order: Order,
  items: OrderItem[],
  resendApiKey: string,
  senderAddress: string,
  appOrigin: string,
): Promise<void> {
  const trackUrl = `${appOrigin}/track-order`;
  const html = buildEmailHtml(order, items, trackUrl);
  const subject = `Sweet Bakes — Order Confirmation ${order.order_number ?? ""}`.trim();
  const recipientName = [order.first_name, order.last_name].filter(Boolean).join(" ") || "Valued Customer";

  const payload = {
    from: senderAddress,
    to: [{ email: order.email!, name: recipientName }],
    subject,
    html,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body.slice(0, 400)}`);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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
      .select("id, order_number, customer_id, email, first_name, last_name, order_method, preferred_date, preferred_time, total, required_down_payment, payment_status, order_status, amount_paid, loyalty_reward_applied, loyalty_discount_percent, loyalty_discount_amount, payment_amount_due, guest_confirmation_email_claimed_at, guest_confirmation_email_sent_at") as {
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

    const customOrder = (orders ?? []).find((candidate) => referenceForOrder(candidate) === referenceId) ?? null;
    const regularOrder = (orders ?? []).find((candidate) => regularReferenceForOrder(candidate) === referenceId) ?? null;
    const order = customOrder ?? regularOrder;
    const isRegularPayment = Boolean(regularOrder);
    if (!order) {
      return jsonResponse({ received: true, result: "ignored_unknown_reference" });
    }

    // The discounted down payment (payment_amount_due) is the authoritative
    // charged amount recorded when the payment session was created. Fall back to
    // the full required_down_payment only when no session amount was persisted.
    const expectedAmount = Number(
      isRegularPayment
        ? order.total
        : Number(order.payment_amount_due) > 0
          ? order.payment_amount_due
          : order.required_down_payment,
    );
    if (!Number.isFinite(expectedAmount) || Math.round(expectedAmount * 100) !== Math.round(amount * 100)) {
      console.error("[XENDIT WEBHOOK] amount mismatch", {
        event,
        referenceId,
        orderId: order.id,
        amount,
        expectedAmount,
        discountAmount: Number(order.payment_amount_due) > 0 ? Number(order.loyalty_discount_amount) : 0,
      });
      return jsonResponse({ error: "Payment amount does not match the order." }, 400);
    }

    if (order.payment_status === "paid") {
      return jsonResponse({ received: true, result: "already_processed", orderId: order.id });
    }
    const validOrderState = isRegularPayment
      ? order.order_status === "pending" && ["unpaid", "pending"].includes(order.payment_status ?? "")
      : order.order_status === "confirmed" && order.payment_status === "pending";
    if (!validOrderState) {
      return jsonResponse({ received: true, result: "ignored_order_state", orderId: order.id });
    }

    let updateQuery = supabaseAdmin
      .from("orders")
      .update({
        payment_status: "paid",
        amount_paid: Math.round(amount * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    updateQuery = isRegularPayment
      ? updateQuery.eq("order_status", "pending").in("payment_status", ["unpaid", "pending"])
      : updateQuery.eq("order_status", "confirmed").eq("payment_status", "pending");
    const { error: updateError } = await updateQuery;

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
      amountPaid: Math.round(amount * 100) / 100,
      loyaltyRewardApplied: Boolean(order.loyalty_reward_applied),
      loyaltyDiscountAmount: Number(order.loyalty_discount_amount) || 0,
      requiredDownPayment: Number(order.required_down_payment) || 0,
      currentPaymentStatus: order.payment_status,
      updateResult: "payment_status_paid",
      result: "payment_verified",
    });

    // ── Guest confirmation email ──────────────────────────────────────────────
    // Guards:
    //   1. Regular cart payment only (isRegularPayment). Custom cake down-payments
    //      go through a different flow and are not guest Sweet Treats orders.
    //   2. customer_id === null — explicit guest guard. Authenticated orders must
    //      never receive this email.
    //   3. Non-empty email address on the order.
    //   4. sent_at IS NULL — email has not already been successfully delivered.
    if (
      isRegularPayment &&
      order.customer_id === null &&
      order.email &&
      order.guest_confirmation_email_sent_at === null
    ) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      const senderAddress = Deno.env.get("RESEND_SENDER_ADDRESS") ?? "Sweet Bakes <orders@sweetbakes.com>";
      const appUrl = Deno.env.get("SWEET_BAKES_APP_URL");

      let appOrigin: string | null = null;
      try {
        const parsed = new URL(appUrl ?? "");
        if (parsed.protocol === "https:") appOrigin = parsed.origin;
      } catch {
        // appOrigin stays null — logged below
      }

      if (!resendApiKey) {
        console.warn("[XENDIT WEBHOOK] RESEND_API_KEY not configured — skipping guest confirmation email", {
          orderId: order.id,
          orderNumber: order.order_number,
        });
      } else if (!appOrigin) {
        console.warn("[XENDIT WEBHOOK] SWEET_BAKES_APP_URL not configured or invalid — skipping guest confirmation email", {
          orderId: order.id,
          orderNumber: order.order_number,
        });
      } else {
        // ── Stale-claim recovery ────────────────────────────────────────────
        // If a previous webhook invocation claimed (set claimed_at) but then
        // crashed before clearing it, the claim will be stuck. We treat any
        // claim older than 5 minutes as stale and clear it so this invocation
        // can proceed. 5 minutes is far longer than any normal Resend round-trip
        // and far shorter than Xendit's retry interval, so it is safe.
        const STALE_CLAIM_MS = 5 * 60 * 1000;
        if (order.guest_confirmation_email_claimed_at !== null) {
          const claimedAt = new Date(order.guest_confirmation_email_claimed_at).getTime();
          const isStale = Number.isFinite(claimedAt) && (Date.now() - claimedAt) > STALE_CLAIM_MS;
          if (!isStale) {
            // A live claim exists — another concurrent webhook is handling this.
            // Do not attempt to send; return normally so payment response is 200.
            console.log("[XENDIT WEBHOOK] guest confirmation email claim is active — skipping concurrent duplicate", {
              orderId: order.id,
              orderNumber: order.order_number,
              claimedAt: order.guest_confirmation_email_claimed_at,
            });
            return jsonResponse({ received: true, result: "payment_verified", orderId: order.id });
          }
          // Stale claim: clear it so the conditional UPDATE below can succeed.
          console.warn("[XENDIT WEBHOOK] clearing stale email claim", {
            orderId: order.id,
            orderNumber: order.order_number,
            claimedAt: order.guest_confirmation_email_claimed_at,
          });
          await supabaseAdmin
            .from("orders")
            .update({ guest_confirmation_email_claimed_at: null })
            .eq("id", order.id)
            .eq("guest_confirmation_email_claimed_at", order.guest_confirmation_email_claimed_at)
            .is("guest_confirmation_email_sent_at", null);
          // Whether or not the clear succeeded, fall through to the atomic claim
          // below. If another webhook beat us to the clear and claimed first, our
          // claim UPDATE will return zero rows and we will skip safely.
        }

        // ── Atomic claim via claimed_at ─────────────────────────────────────
        // Condition: claimed_at IS NULL AND sent_at IS NULL.
        // Only one concurrent webhook can update exactly one row.
        // sent_at IS NOT written here — only claimed_at.
        const claimTimestamp = new Date().toISOString();
        const { data: claimResult, error: claimError } = await supabaseAdmin
          .from("orders")
          .update({ guest_confirmation_email_claimed_at: claimTimestamp })
          .eq("id", order.id)
          .is("guest_confirmation_email_claimed_at", null)
          .is("guest_confirmation_email_sent_at", null)
          .select("id")
          .maybeSingle() as { data: { id: string } | null; error: { message?: string } | null };

        if (claimError) {
          // Non-fatal — payment is already recorded.
          console.error("[XENDIT WEBHOOK] email claim update failed — skipping email", {
            orderId: order.id,
            orderNumber: order.order_number,
            error: claimError.message ?? null,
          });
        } else if (!claimResult) {
          // Zero rows updated — another webhook already holds the claim.
          console.log("[XENDIT WEBHOOK] guest confirmation email claim lost race — skipping", {
            orderId: order.id,
            orderNumber: order.order_number,
          });
        } else {
          // ── We own the claim. Fetch items and send. ─────────────────────
          const { data: itemRows, error: itemsError } = await supabaseAdmin
            .from("order_items")
            .select("product_name, variant_name, quantity, unit_price, subtotal, customization_data")
            .eq("order_id", order.id) as { data: OrderItem[] | null; error: { message?: string } | null };

          if (itemsError) {
            // Release claim so a future retry can attempt the email.
            // Payment status is unaffected.
            console.error("[XENDIT WEBHOOK] failed to load order items for email — releasing claim", {
              orderId: order.id,
              orderNumber: order.order_number,
              error: itemsError.message ?? null,
            });
            await supabaseAdmin
              .from("orders")
              .update({ guest_confirmation_email_claimed_at: null })
              .eq("id", order.id);
          } else {
            let emailSent = false;
            try {
              await sendConfirmationEmail(
                order,
                itemRows ?? [],
                resendApiKey,
                senderAddress,
                appOrigin,
              );
              emailSent = true;
            } catch (emailError) {
              // Resend failed. Payment is already recorded as paid — do not
              // touch payment_status. Release the claim so a future webhook
              // delivery or manual retry can attempt the email again.
              console.error("[XENDIT WEBHOOK] guest confirmation email failed — releasing claim for retry", {
                orderId: order.id,
                orderNumber: order.order_number,
                error: emailError instanceof Error ? emailError.message : String(emailError),
              });
              await supabaseAdmin
                .from("orders")
                .update({ guest_confirmation_email_claimed_at: null })
                .eq("id", order.id);
            }

            if (emailSent) {
              // ── Resend accepted the email. ──────────────────────────────
              // NOW write sent_at and clear claimed_at atomically.
              // sent_at is only ever written here, after confirmed Resend success.
              const sentTimestamp = new Date().toISOString();
              const { error: finalizeError } = await supabaseAdmin
                .from("orders")
                .update({
                  guest_confirmation_email_sent_at: sentTimestamp,
                  guest_confirmation_email_claimed_at: null,
                })
                .eq("id", order.id);

              if (finalizeError) {
                // The email was sent but we failed to record it. Log clearly.
                // The next webhook delivery will see claimed_at still set and
                // treat it as stale after the timeout, then attempt to send
                // again. Resend's own deduplication may suppress the duplicate
                // at the provider level, but we log this for manual review.
                console.error("[XENDIT WEBHOOK] email sent but failed to write sent_at — may retry", {
                  orderId: order.id,
                  orderNumber: order.order_number,
                  error: finalizeError.message ?? null,
                });
              } else {
                console.log("[XENDIT WEBHOOK] guest confirmation email sent and recorded", {
                  orderId: order.id,
                  orderNumber: order.order_number,
                  recipient: order.email,
                  sentAt: sentTimestamp,
                });
              }
            }
          }
        }
      }
    }

    return jsonResponse({ received: true, result: "payment_verified", orderId: order.id });
  }),
};
