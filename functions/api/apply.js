// POST /api/apply  ->  saves a Blueprint application to Brevo and emails you the full copy.
// Cloudflare Pages Function. Environment variables (same pattern as intake.js):
//   BREVO_API_KEY, BREVO_LIST_APPLICANTS (numeric list ID), NOTIFY_EMAIL, SENDER_EMAIL, SENDER_NAME (optional)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const cut = (v, n = 1000) => String(v ?? "").trim().slice(0, n);
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const email = cut(b.email, 200).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || b.consent !== true || !cut(b.name)) return json({ error: "Missing name, email or consent" }, 400);
  if (!env.BREVO_API_KEY || !env.BREVO_LIST_APPLICANTS) return json({ error: "Server not configured" }, 500);

  const attributes = {
    FIRSTNAME: cut(b.name, 100),
    APPLY_WORK: cut(b.work), APPLY_CHALLENGE: cut(b.challenge, 200), APPLY_TRIED: cut(b.tried),
    APPLY_EVIDENCE: cut(b.evidence), APPLY_WHO: cut(b.who), APPLY_COMMIT: cut(b.commit, 100),
    APPLY_INVEST: cut(b.invest, 100), APPLY_WORTH: cut(b.worth), APPLY_EXTRA: cut(b.extra),
    APPLICATION_STATUS: "Applied", APPLICATION_DATE: new Date().toISOString().slice(0, 10),
  };
  const headers = { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" };
  const c = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST", headers,
    body: JSON.stringify({ email, attributes, listIds: [Number(env.BREVO_LIST_APPLICANTS)], updateEnabled: true }),
  });
  if (!c.ok) { console.error("Brevo contact error", c.status, await c.text()); return json({ error: "Could not save application" }, 502); }

  if (env.NOTIFY_EMAIL && env.SENDER_EMAIL) {
    const rows = [["Name", b.name], ["Email", email], ["Work, skills, experience", b.work], ["Biggest challenge", b.challenge], ["Already tried", b.tried], ["Clients, work, samples, response", b.evidence], ["Who might need it", b.who], ["Can commit 2–4 hours/week for 8 weeks", b.commit], ["Investment option", b.invest], ["What would make it worth it", b.worth], ["Anything else", b.extra]];
    const html = "<h2>New Blueprint application</h2>" + rows.filter(r => r[1]).map(r => `<p><b>${esc(r[0])}</b><br>${esc(r[1]).replace(/\n/g, "<br>")}</p>`).join("");
    try {
      const m = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers, body: JSON.stringify({ sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || "Brenda Blanche" }, to: [{ email: env.NOTIFY_EMAIL }], replyTo: { email }, subject: `New Blueprint application: ${cut(b.name, 60)}`, htmlContent: html }) });
      if (!m.ok) console.error("Brevo email error", m.status, await m.text());
    } catch (e) { console.error("Brevo email exception", String(e)); }
  }
  return json({ ok: true });
}
