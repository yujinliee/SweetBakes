import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { createClient } from "@supabase/supabase-js";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ORDER_NUMBER = "SB-20260924-0067";
const PAYMENT_SESSION_ID = "ps-6ab4bc8d7d8203d8fc085ee0";
const PAYMENT_ID = "py-c72d8a03-da67-4ebd-b27e-ba7290eef6de";
const REFERENCE_ID = "SBSB202609240067FULL";
const AMOUNT = 144;

export default { fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) return json({ error: "Authentication is required." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const xendit = Deno.env.get("XENDIT_SECRET_KEY");
  if (!url || !anon || !xendit) return json({ error: "Recovery service is not configured." }, 500);
  const userClient = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) return json({ error: "Authentication is required." }, 401);
  const { data: profile, error: profileError } = await ctx.supabaseAdmin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profileError) return json({ error: "Unable to verify administrator access." }, 500);
  if (profile?.role !== "admin") return json({ error: "Administrator access is required." }, 403);

  const providerResponse = await fetch(`https://api.xendit.co/sessions/${encodeURIComponent(PAYMENT_SESSION_ID)}`, { headers: { Authorization: `Basic ${btoa(`${xendit}:`)}` } }).catch(() => null);
  if (!providerResponse) return json({ error: "Unable to verify the canonical provider payment." }, 502);
  const provider = await providerResponse.json().catch(() => ({})) as Record<string, unknown>;
  const status = typeof provider.status === "string" ? provider.status.toUpperCase() : "";
  const amount = Number(provider.amount);
  if (!providerResponse.ok || status !== "COMPLETED" || amount !== AMOUNT || provider.payment_session_id !== PAYMENT_SESSION_ID || provider.payment_id !== PAYMENT_ID || provider.reference_id !== REFERENCE_ID) {
    return json({ error: "Canonical provider payment verification failed." }, 409);
  }

  const { data, error } = await ctx.supabaseAdmin.rpc("recover_order_0067_payment_a");
  if (error) return json({ error: "The one-time recovery could not be completed." }, 500);
  return json({ order_number: ORDER_NUMBER, provider_payment: "verified", result: data?.result ?? "unknown" });
}) };
