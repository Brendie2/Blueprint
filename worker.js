/* Blueprint worker. Serves the site and handles:
     POST /api/apply          application form -> Brevo contact + email to Brenda
     POST /api/onboarding     onboarding questionnaire -> Brevo contact + email to Brenda
     POST /api/selar-webhook?key=...   verified purchase -> Brevo contact + ONE welcome email
   Variables and Secrets (Settings > Variables and Secrets):
     BREVO_API_KEY (Secret) · BREVO_LIST_ID · NOTIFY_EMAIL · SENDER_EMAIL
     WEBHOOK_SECRET (Secret)   random string; put it in the webhook URL as ?key=
     SELAR_PRODUCT_MATCH       optional text that must appear in the product name (e.g. Blueprint)
     MATERIALS_URL, BOOKING_URL   optional; welcome email shows a link only if it is set
     SITE_URL                  e.g. https://blueprint.brendablanche.site                              */

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const val = v => Array.isArray(v) ? v.join(', ') : String(v ?? '').trim();
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const brevo = (path, env, body, method = 'POST') => fetch('https://api.brevo.com/v3' + path, {
  method, headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const listIds = env => env.BREVO_LIST_ID ? [Number(env.BREVO_LIST_ID)] : undefined;
const mail = (env, to, subject, html, replyTo, senderName = 'Brenda Blanche') => brevo('/smtp/email', env, { sender: { email: env.SENDER_EMAIL, name: senderName }, to: [to], replyTo: replyTo || { email: env.NOTIFY_EMAIL }, subject, htmlContent: html });
const wrap = inner => `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#14100F">${inner}</div>`;
const rowsHtml = rows => '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">' + rows.map(([q, a]) => `<p><b>${esc(q)}</b><br>${esc(val(a)).replace(/\n/g, '<br>') || '<i>(blank)</i>'}</p>`).join('') + '</div>';

/* ---------- public: application ---------- */
async function handleApply(request, env) {
  let d; try { d = await request.json(); } catch { return json({ ok: false }, 400); }
  if (d['bot-field']) return json({ ok: true });
  const name = val(d.name), email = val(d.email).toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false }, 400);
  const [first, ...rest] = name.split(/\s+/);
  const listIds = env.BREVO_LIST_ID ? [Number(env.BREVO_LIST_ID)] : undefined;

  const full = { FIRSTNAME: first, LASTNAME: rest.join(' '), WHATSAPP: val(d.whatsapp), LINKEDIN: val(d.linkedin), WEBSITE: val(d.website),
    PREFERRED_CONTACT: val(d.preferred_contact), STARTING_POINT: val(d.starting_point), APPLICATION_STATUS: 'New' };
  let r = await brevo('/contacts', env, { email, attributes: full, listIds, updateEnabled: true });
  if (r.status === 400) r = await brevo('/contacts', env, { email, attributes: { FIRSTNAME: first, LASTNAME: rest.join(' ') }, listIds, updateEnabled: true });
  const rows = [['Name', name], ['Email', email], ['WhatsApp', d.whatsapp], ['Preferred contact', d.preferred_contact], ['LinkedIn', d.linkedin], ['Website', d.website],
    ['Other link', d.other_link], ['1. Expertise and experience', d.expertise], ['2. Service status', d.starting_point], ['   What they offer', d.offer],
    ['3. Who they want to help', d.audience], ["4. What's happening", d.happening], ['5. Tried', d.tried], ['   What happened', d.what_happened],
    ['6. Proof / evidence', d.evidence], ['7. Hope after 8 weeks', d.hope], ['8. Ready to implement', d.ready], ['   Weekly commitment', d.commitment], ['9. Anything else', d.extra]];
  const html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">' + rows.map(([q, a]) => `<p><b>${esc(q)}</b><br>${esc(val(a)).replace(/\n/g, '<br>') || '<i>(blank)</i>'}</p>`).join('') + '</div>';
  const m = await brevo('/smtp/email', env, { sender: { email: env.SENDER_EMAIL, name: 'Blueprint Applications' }, to: [{ email: env.NOTIFY_EMAIL }], replyTo: { email, name }, subject: `Blueprint application: ${name}`, htmlContent: html });
  if (r.ok || m.ok) {
    await brevo('/smtp/email', env, { sender: { email: env.SENDER_EMAIL, name: 'Brenda Blanche' }, to: [{ email, name }], replyTo: { email: env.NOTIFY_EMAIL }, subject: 'Your Market Perception Blueprint application',
      htmlContent: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6"><p>Hi ${esc(first)},</p><p>Thank you for applying for the Market Perception Blueprint. Your application has been received.</p><p>I personally review every application to make sure the engagement is a strong fit for where you are and what you're trying to build. You'll hear from me by email within 2–3 business days.</p><p>No payment is required at this stage.</p><p>— Brenda</p></div>` }).catch(() => {});
  }
  return (r.ok || m.ok) ? json({ ok: true }) : json({ ok: false }, 502);
}


/* ---------- public: onboarding questionnaire ---------- */
async function handleOnboarding(request, env) {
  let d; try { d = await request.json(); } catch { return json({ ok: false }, 400); }
  if (d['bot-field']) return json({ ok: true });
  const name = val(d.name), email = val(d.email).toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return json({ ok: false }, 400);
  const [first, ...rest] = name.split(/\s+/);
  const r = await brevo('/contacts', env, { email, attributes: { FIRSTNAME: first, LASTNAME: rest.join(' '), BLUEPRINT_STATUS: 'Onboarding submitted' }, listIds: listIds(env), updateEnabled: true });
  const rows = [['Name', name], ['Email', email], ['Expertise', d.expertise], ['Current offer', d.offer], ['Who they want to help', d.audience], ['What they want to change', d.change],
    ["What's happening in the market", d.happening], ['Materials', d.materials], ['Evidence', d.evidence], ['Time zone', d.timezone], ['Session availability', d.slots], ['Anything else', d.extra]];
  const m = await mail(env, { email: env.NOTIFY_EMAIL }, `Blueprint onboarding: ${name}`, rowsHtml(rows), { email, name }, 'Blueprint Onboarding');
  return (m.ok || r.ok) ? json({ ok: true }) : json({ ok: false }, 502);
}

/* ---------- Selar purchase webhook ---------- */
/* Selar's exact payload fields have not been verified here, so the reader below is tolerant: it looks for the
   usual names. Check one real test payload (it is emailed to NOTIFY_EMAIL when a webhook is rejected as
   "unrecognised") and adjust pick() if needed. */
const pick = (o, keys) => { for (const k of keys) { const v = k.split('.').reduce((a, p) => (a == null ? a : a[p]), o); if (v != null && String(v).trim()) return String(v).trim(); } return ''; };
async function handleSelar(request, env, url) {
  if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) return json({ ok: false }, 401);
  let p = {}; const ct = request.headers.get('content-type') || '';
  try { p = ct.includes('json') ? await request.json() : Object.fromEntries(await request.formData()); } catch { return json({ ok: false }, 400); }
  const email = pick(p, ['email', 'customer.email', 'data.customer.email', 'data.email', 'buyer.email']).toLowerCase();
  const fullName = pick(p, ['name', 'customer.name', 'data.customer.name', 'data.name', 'customer_name', 'buyer.name']);
  const product = pick(p, ['product.name', 'product_name', 'data.product.name', 'product.title', 'data.product_name', 'product']);
  const ref = pick(p, ['reference', 'transaction_id', 'order_id', 'id', 'data.reference', 'data.id', 'data.order_id', 'data.transaction_id']);
  const status = pick(p, ['status', 'data.status', 'payment_status', 'event']).toLowerCase();
  const paid = !status || /success|paid|complete|confirm|charge/.test(status);
  const ok = /^\S+@\S+\.\S+$/.test(email) && paid && (!env.SELAR_PRODUCT_MATCH || product.toLowerCase().includes(env.SELAR_PRODUCT_MATCH.toLowerCase()));
  if (!ok) {   // do NOT start onboarding; tell Brenda so a real purchase is never silently missed
    await mail(env, { email: env.NOTIFY_EMAIL }, 'Blueprint webhook: not processed', rowsHtml([['Reason', 'No valid email, not a paid status, or not the Blueprint product'], ['Payload', JSON.stringify(p).slice(0, 1500)]]), null, 'Blueprint System');
    return json({ ok: true, processed: false });
  }
  // duplicate protection: Selar may retry. If this reference was already handled, do nothing.
  const ex = await brevo('/contacts/' + encodeURIComponent(email), env, null, 'GET');
  if (ex.ok) { const c = await ex.json(); if (ref && c.attributes?.BLUEPRINT_ENROLLED_REF === ref) return json({ ok: true, duplicate: true }); }
  const [first, ...rest] = (fullName || email.split('@')[0]).split(/\s+/);
  const r = await brevo('/contacts', env, { email, attributes: { FIRSTNAME: first, LASTNAME: rest.join(' '), BLUEPRINT_STATUS: 'Enrolled', BLUEPRINT_ENROLLED_REF: ref || 'no-ref' }, listIds: listIds(env), updateEnabled: true });
  const site = (env.SITE_URL || '').replace(/\/$/, '');
  const links = [['1. Complete your onboarding questionnaire', site + '/onboarding.html'], ['2. Share your existing materials', env.MATERIALS_URL], ['3. Schedule your first session', env.BOOKING_URL]].filter(([, u]) => u && /^https?:/.test(u));
  const li = links.map(([t, u]) => `<p style="margin:0 0 14px"><b>${esc(t)}</b><br><a href="${esc(u)}" style="color:#E4007C">${esc(u)}</a></p>`).join('');
  const html = wrap(`<p>Hi ${esc(first)},</p><p>Your payment has been confirmed, and you&rsquo;re officially enrolled in the <b>Market Perception Blueprint</b>.</p><p>Welcome!</p>
<p>Over the next eight weeks, we&rsquo;ll work together to identify the gap between the value you can deliver and how clearly the right people understand, trust, and evaluate that value.</p>
<p>We&rsquo;ll begin by understanding your current situation before deciding what needs to change.</p><h3 style="margin:24px 0 10px">Here&rsquo;s what to do next</h3>${li}
<p>Please complete the onboarding questionnaire first so we can make our initial session as useful as possible.</p><p>You don&rsquo;t need to have everything figured out before we begin. That&rsquo;s what the process is for.</p>
<p>I&rsquo;ll guide you through the work, help you make the important strategic decisions, and work with you to implement the changes that matter most.</p><p>Let&rsquo;s get started.</p><p>Brenda</p>`);
  const m = await mail(env, { email, name: fullName || first }, "You're enrolled: welcome to the Market Perception Blueprint", html);
  await mail(env, { email: env.NOTIFY_EMAIL }, `New Blueprint enrollment: ${fullName || email}`, rowsHtml([['Name', fullName], ['Email', email], ['Reference', ref], ['Welcome email sent', m.ok ? 'Yes' : 'FAILED, send it manually']]), null, 'Blueprint System');
  return (m.ok || r.ok) ? json({ ok: true }) : json({ ok: false }, 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (request.method === 'POST' && path === '/api/apply') return handleApply(request, env);
    if (request.method === 'POST' && path === '/api/onboarding') return handleOnboarding(request, env);
    if (request.method === 'POST' && path === '/api/selar-webhook') return handleSelar(request, env, url);
    if (path.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
