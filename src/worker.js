// Cloudflare Worker entry: src/worker.js
// Serves the site from /public (static assets) and handles POST /api/apply:
// 1) Saves the application as a contact in Brevo (with the decision stored as an attribute).
// 2) Decides: ACCEPT / CLARITY CALL / NOT A FIT (rules live in src/decide.js).
// 3) Emails the applicant the matching branded email, addressed to their name, from you.
// 4) Emails you a notice with the full answers and the decision.
//
// VARIABLES: plain values live in wrangler.json ("vars"). BREVO_API_KEY is a Secret set in the
// Cloudflare dashboard (your Worker > Settings > Variables and Secrets).
//   BREVO_API_KEY      Secret   your Brevo v3 API key
//   BREVO_LIST_ID      Text     numeric ID of the Brevo list that receives applicants
//   SENDER_EMAIL       Text     the "from" address, must be a verified sender in Brevo
//   NOTIFY_EMAIL       Text     your inbox, receives a notice for every application
//   SENDER_NAME        Text     optional (default "Brenda Blanche")
//   ALLOWED_ORIGIN     Text     optional, only if the page is on a different domain than this Worker
//   REPLY_TO_EMAIL     Text     optional (default = SENDER_EMAIL)
//   SELAR_URL          Text     optional (default https://selar.com/10sg102013)
//   CLARITY_CALL_URL   Text     optional (default https://cal.com/brenda-blanche/clarity-call)
//   SCORECARD_URL      Text     optional, adds a Scorecard button to the "not a fit" email
//
// BREVO CONTACT ATTRIBUTES (type Text): LINKEDIN, SERVICE_WORK, YEARS_EXPERIENCE, SITUATION,
//   WANTS_HELP_WITH, CLIENT_SOURCES, SESSIONS_READY, INVEST_READY, NOTES, ACK_NO_GUARANTEE,
//   ACK_PRIVACY, APPLIED_AT, APPLICATION_SOURCE, APPLICATION_DECISION, DECISION_REASON

import { decide, REASON_LABEL } from './decide.js';
import { applicantEmail, ownerNotice } from './emails.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

const clip = (v, n = 1000) => String(v == null ? '' : v).slice(0, n);
const clipList = (a) => (Array.isArray(a) ? a.map((x) => clip(x, 200)).slice(0, 10) : []);
const join = (a) => (Array.isArray(a) ? a.map((x) => clip(x, 200)).join(' | ') : clip(a, 400));

async function sendEmail(env, { to, toName, subject, html, text, replyTo, tag }) {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || 'Brenda Blanche' },
        to: [toName ? { email: to, name: toName } : { email: to }],
        replyTo: { email: replyTo || env.REPLY_TO_EMAIL || env.SENDER_EMAIL },
        subject,
        htmlContent: html,
        textContent: text,
        tags: [tag],
      }),
    });
    if (!res.ok) console.log('Brevo email error', tag, res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.log('Brevo email exception', tag, String(e));
    return false;
  }
}

async function handleApply(request, env) {
  let raw;
  try { raw = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }

  // Honeypot: bots fill the hidden field. Pretend success, store and send nothing.
  if (raw.website) return json({ ok: true });

  const d = {
    fullName: clip(raw.fullName, 200).trim(),
    email: clip(raw.email, 200).trim().toLowerCase(),
    linkedin: clip(raw.linkedin, 500).trim(),
    serviceWork: clip(raw.serviceWork, 500).trim(),
    years: clip(raw.years, 100),
    situation: clip(raw.situation, 300),
    wantsHelp: clipList(raw.wantsHelp),
    clientSources: clipList(raw.clientSources),
    sessionsReady: clip(raw.sessionsReady, 200),
    investReady: clip(raw.investReady, 200),
    notes: clip(raw.notes, 2000).trim(),
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return json({ error: 'Invalid email' }, 400);
  if (!raw.ackNoGuarantee || !raw.ackPrivacy) return json({ error: 'Acknowledgements required' }, 400);
  if (!env.BREVO_API_KEY || !env.SENDER_EMAIL) return json({ error: 'Server not configured' }, 500);

  const { decision, reasons } = decide(d);
  const urls = {
    selar: env.SELAR_URL || 'https://selar.com/10sg102013',
    clarity: env.CLARITY_CALL_URL || 'https://cal.com/brenda-blanche/clarity-call',
    scorecard: env.SCORECARD_URL || 'scorecard.brendablanche.site',
  };

  // 1) Save the contact in Brevo
  const contact = {
    email: d.email,
    updateEnabled: true,
    attributes: {
      FIRSTNAME: d.fullName,
      LINKEDIN: d.linkedin,
      SERVICE_WORK: d.serviceWork,
      YEARS_EXPERIENCE: d.years,
      SITUATION: d.situation,
      WANTS_HELP_WITH: join(d.wantsHelp),
      CLIENT_SOURCES: join(d.clientSources),
      SESSIONS_READY: d.sessionsReady,
      INVEST_READY: d.investReady,
      NOTES: d.notes,
      ACK_NO_GUARANTEE: 'Yes',
      ACK_PRIVACY: 'Yes',
      APPLIED_AT: new Date().toISOString(),
      APPLICATION_SOURCE: 'Market Perception Build page',
      APPLICATION_DECISION: decision,
      DECISION_REASON: reasons.map((r) => REASON_LABEL[r] || r).join('; '),
    },
  };
  if (env.BREVO_LIST_ID) contact.listIds = [Number(env.BREVO_LIST_ID)];

  let saved = false;
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(contact),
    });
    saved = res.status === 201 || res.status === 204; // 201 created, 204 updated
    if (!saved) console.log('Brevo contact error', res.status, await res.text());
  } catch (e) {
    console.log('Brevo contact exception', String(e));
  }

  // 2) Email the applicant, 3) email you. Both are always attempted.
  const mail = applicantEmail(decision, d, reasons, urls);
  const sent = await sendEmail(env, {
    to: d.email,
    toName: d.fullName,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    tag: 'build-application-' + decision,
  });

  let notified = false;
  if (env.NOTIFY_EMAIL) {
    const note = ownerNotice(decision, d, reasons, sent);
    notified = await sendEmail(env, {
      to: env.NOTIFY_EMAIL,
      subject: note.subject,
      html: note.html,
      text: note.text,
      replyTo: d.email, // hitting Reply answers the applicant
      tag: 'build-application-notice',
    });
  }

  // The application counts as received if it was saved OR you were notified (nothing is lost).
  if (saved || notified || sent) return json({ ok: true, decision });
  return json({ error: 'Could not save application' }, 502);
}

// Optional CORS: only needed if the page is hosted on a different domain than this Worker.
// Set ALLOWED_ORIGIN to that domain (comma-separated for several). Same-origin needs nothing.
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGIN || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  }
  return {};
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/apply') {
      const cors = corsHeaders(request, env);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      const res = await handleApply(request, env);
      const out = new Response(res.body, res);
      Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
      return out;
    }
    // Everything else is the static site in /public
    return env.ASSETS.fetch(request);
  },
};
