import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
function getNamedSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const value = Object.values(parsed as Record<string, unknown>).find((entry) => typeof entry === "string" && entry.length > 0);
    return typeof value === "string" ? value : null;
  } catch { return null; }
}

export default { fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) return json({ error: "Authentication is required." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const secret = Deno.env.get("SUPABASE_SECRET_KEY") ?? getNamedSecretKey() ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const xendit = Deno.env.get("XENDIT_SECRET_KEY");
  if (!url || !anon || !secret || !xendit) return json({ error: "Maintenance service is not configured." }, 500);
  const userClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Authentication is required." }, 401);
  const admin = ctx.supabaseAdmin;
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profileError) return json({ error: "Unable to verify administrator access." }, 500);
  if (profile?.role !== "admin") return json({ error: "Administrator access is required." }, 403);
  let input: Record<string, unknown> = {};
  try { const parsed = await req.json(); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) input = parsed as Record<string, unknown>; } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const orderNumber = input.order_number === "SB-20260923-0066" ? input.order_number : "SB-20260923-0066";
  const { data: order, error: orderError } = await admin.from("orders").select("id, order_number, customer_id, payment_status, order_status, total, payment_amount_due, loyalty_reward_applied").eq("order_number", orderNumber).maybeSingle();
  if (orderError || !order) return json({ error: "Target order was not found." }, 404);
  if (order.payment_status === "paid") return json({ order_number: order.order_number, local_payment_status: order.payment_status, cleanup: "Blocked", reason: "Order is already paid." });
  const { data: reward, error: rewardError } = await admin.from("customer_loyalty_rewards").select("id, status, reserved_order_id, xendit_payment_session_id, reservation_expires_at").eq("customer_id", order.customer_id).not("xendit_payment_session_id", "is", null).order("cycle_number", { ascending: true }).limit(1).maybeSingle();
  if (rewardError || !reward?.xendit_payment_session_id) return json({ order_number: order.order_number, local_payment_status: order.payment_status, cleanup: "Blocked", reason: "No stored payment session binding was found." });
  const sessionId = reward.xendit_payment_session_id;
  const response = await fetch(`https://api.xendit.co/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Basic ${btoa(`${xendit}:`)}` } }).catch(() => null);
  if (!response) return json({ order_number: order.order_number, local_payment_status: order.payment_status, session_status: "UNKNOWN", session_still_payable: null, cleanup: "Blocked" }, 502);
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  const status = typeof body.status === "string" ? body.status.toUpperCase() : "UNKNOWN";
  const reference = typeof body.reference_id === "string" ? body.reference_id : null;
  const matches = reference ? reference.includes(String(order.order_number).replace(/[^a-zA-Z0-9]/g, "")) : null;
  const stillPayable = status === "ACTIVE";
  if (!["EXPIRED", "CANCELED"].includes(status)) return json({ order_number: order.order_number, local_payment_status: order.payment_status, session_status: status, session_amount: body.amount ?? null, session_expires_at: body.expires_at ?? null, session_reference: reference, session_matches_order: matches, session_still_payable: stillPayable, cleanup: "Blocked", reason: status === "ACTIVE" ? "Payment session is still active." : status === "COMPLETED" ? "Provider reports completed payment." : "Provider status could not authorize cleanup." });
  const { data: currentReward } = await admin.from("customer_loyalty_rewards").select("id, status, reserved_order_id, xendit_payment_session_id").eq("id", reward.id).maybeSingle();
  if (!currentReward || currentReward.status !== "reserved" || currentReward.reserved_order_id !== order.id || currentReward.xendit_payment_session_id !== sessionId) return json({ order_number: order.order_number, local_payment_status: order.payment_status, session_status: status, session_amount: body.amount ?? null, session_expires_at: body.expires_at ?? null, session_reference: reference, session_matches_order: matches, session_still_payable: false, cleanup: "Blocked", reason: "The canonical cleanup helper cannot match the exact active reservation." });
  const { error: cleanupError } = await admin.rpc("release_customer_loyalty_reservation", { p_order_id: order.id, p_session_id: sessionId });
  if (cleanupError) return json({ order_number: order.order_number, local_payment_status: order.payment_status, session_status: status, session_matches_order: matches, cleanup: "Blocked", reason: "Canonical cleanup failed." }, 500);
  return json({ order_number: order.order_number, local_payment_status: order.payment_status, session_status: status, session_amount: body.amount ?? null, session_expires_at: body.expires_at ?? null, session_reference: reference, session_matches_order: matches, session_still_payable: false, cleanup: "Completed" });
}) };
