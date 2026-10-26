/**
 * Market Perception Build: intake worker (Cloudflare Workers)
 *
 * Receives the intake form from welcome.html, then:
 *  1. Creates or updates the buyer as a Brevo contact (answers saved as attributes)
 *     and adds them to your "Build clients" list. A Brevo automation triggered by
 *     "contact added to list" sends the onboarding email.
 *  2. Emails you the full intake, so nothing is lost even if an attribute is missing.
 *  3. OPTIONAL: sends the onboarding email instantly from a Brevo template.
 *     Use this OR the list automation, not both, or the buyer gets two emails.
 *
 * Variables (wrangler.json "vars") and secrets (npx wrangler secret put NAME):
 *   BREVO_API_KEY            secret
 *   BREVO_LIST_ID            e.g. "12"  (the list your onboarding automation watches)
 *   ALLOWED_ORIGIN           "https://blueprint.brendablanche.site" (no trailing slash)
 *   NOTIFY_EMAIL             where you want the copy of each intake
 *   SENDER_EMAIL             a sender already verified in Brevo
 *   SENDER_NAME              e.g. "Brenda Blanche"
 *   ONBOARDING_TEMPLATE_ID   optional, see point 3
 *
 * Brevo text attributes to create first (Contacts > Settings > Contact attributes):
 *   LINKEDIN, LOCATION_TZ, CURRENT_DESCRIPTION, IDEAL_CLIENT, PROBLEM_SOLVED,
 *   CLIENT_SOURCE, PROOF_PROJECTS, TRIED_BEFORE, TEST_PEOPLE, LINKS, NOTES
 * (FIRSTNAME and LASTNAME already exist.)
 */

const json = (obj, status, cors) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'method' }, 405, cors);

    if (env.ALLOWED_ORIGIN) {
      const origin = request.headers.get('Origin') || '';
      if (origin !== env.ALLOWED_ORIGIN) return json({ ok: false, error: 'origin' }, 403, cors);
    }

    let b;
    try {
      b = await request.json();
    } catch {
      return json({ ok: false, error: 'bad_json' }, 400, cors);
    }

    const clean = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
    const d = {
      firstName: clean(b.firstName, 80),
      lastName: clean(b.lastName, 80),
      email: clean(b.email, 200).toLowerCase(),
      linkedin: clean(b.linkedin, 300),
      timezone: clean(b.timezone, 120),
      currentDescription: clean(b.currentDescription),
      idealClient: clean(b.idealClient),
      problemSolved: clean(b.problemSolved),
      clientSource: clean(b.clientSource, 120),
      proofProjects: clean(b.proofProjects),
      triedBefore: clean(b.triedBefore),
      testPeople: clean(b.testPeople),
      links: clean(b.links),
      notes: clean(b.notes),
    };

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) || !d.firstName || b.terms !== true) {
      return json({ ok: false, error: 'invalid' }, 400, cors);
    }

    const headers = {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    };
    const brevo = (path, body) =>
      fetch('https://api.brevo.com/v3' + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const attr = (v) => v.slice(0, 1900);
    const fullName = `${d.firstName} ${d.lastName}`.trim();

    // 1. Contact + list (this is what triggers the onboarding automation)
    const listIds = env.BREVO_LIST_ID ? [Number(env.BREVO_LIST_ID)] : [];
    let contactOk = false;
    try {
      let r = await brevo('/contacts', {
        email: d.email,
        updateEnabled: true,
        listIds,
        attributes: {
          FIRSTNAME: d.firstName,
          LASTNAME: d.lastName,
          LINKEDIN: attr(d.linkedin),
          LOCATION_TZ: attr(d.timezone),
          CURRENT_DESCRIPTION: attr(d.currentDescription),
          IDEAL_CLIENT: attr(d.idealClient),
          PROBLEM_SOLVED: attr(d.problemSolved),
          CLIENT_SOURCE: attr(d.clientSource),
          PROOF_PROJECTS: attr(d.proofProjects),
          TRIED_BEFORE: attr(d.triedBefore),
          TEST_PEOPLE: attr(d.testPeople),
          LINKS: attr(d.links),
          NOTES: attr(d.notes),
        },
      });
      if (!r.ok) {
        // Most likely a custom attribute does not exist yet. Still add them to the list.
        r = await brevo('/contacts', {
          email: d.email,
          updateEnabled: true,
          listIds,
          attributes: { FIRSTNAME: d.firstName, LASTNAME: d.lastName },
        });
      }
      contactOk = r.ok;
    } catch {
      contactOk = false;
    }

    // 2. Full copy of the intake to you
    let mailOk = false;
    if (env.NOTIFY_EMAIL && env.SENDER_EMAIL) {
      const rows = [
        ['Name', fullName],
        ['Email', d.email],
        ['LinkedIn', d.linkedin],
        ['Based in', d.timezone],
        ['How they describe what they do', d.currentDescription],
        ['Who hires them', d.idealClient],
        ['Problem they solve', d.problemSolved],
        ['Where work comes from', d.clientSource],
        ['Projects and client stories', d.proofProjects],
        ['Tried before', d.triedBefore],
        ['People for repeat-back test', d.testPeople],
        ['Links', d.links],
        ['Anything else', d.notes],
        ['Accepted founding terms', 'Yes'],
      ]
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `<p style="margin:0 0 14px"><b>${esc(k)}</b><br>${esc(v).replace(/\n/g, '<br>')}</p>`
        )
        .join('');
      try {
        const m = await brevo('/smtp/email', {
          sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || 'Market Perception Build' },
          to: [{ email: env.NOTIFY_EMAIL }],
          replyTo: { email: d.email, name: fullName },
          subject: `New Build intake: ${fullName}`,
          htmlContent: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#14100F">${rows}</div>`,
        });
        mailOk = m.ok;
      } catch {
        mailOk = false;
      }
    }

    // 3. Optional instant onboarding email from a Brevo template
    if (env.ONBOARDING_TEMPLATE_ID) {
      try {
        await brevo('/smtp/email', {
          to: [{ email: d.email, name: fullName }],
          templateId: Number(env.ONBOARDING_TEMPLATE_ID),
          params: { FIRSTNAME: d.firstName },
        });
      } catch {
        /* the list automation or your copy still covers it */
      }
    }

    if (!contactOk && !mailOk) return json({ ok: false, error: 'upstream' }, 502, cors);
    return json({ ok: true }, 200, cors);
  },
};
