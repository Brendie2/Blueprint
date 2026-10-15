// Cloudflare Pages Function: receives the application form and sends it to Brevo.
// URL on your site: /api/apply
//
// Secret settings it reads (set them in Cloudflare, see the setup manual):
//   BREVO_API_KEY   your Brevo API key (v3)
//   BREVO_LIST_ID   the number of the Brevo list applicants are added to
//   OWNER_EMAIL     where you want the "new application" email sent (optional)
//   SENDER_EMAIL    a sender address already verified in Brevo (needed for OWNER_EMAIL)
//   SENDER_NAME     name shown on that email (optional, defaults to "Blueprint applications")

const BREVO = "https://api.brevo.com/v3";

// form field name -> label used in the owner notification
const FIELDS = {
  FIRSTNAME: "Full name",
  EMAIL: "Email",
  SKILLS: "Work, skills and experience",
  CHALLENGE: "Biggest challenge right now",
  TRIED: "What they have already tried",
  EVIDENCE: "Clients, past work, samples, enquiries, testimonials",
  BUYER: "Who might need their work",
  COMMITMENT: "Can commit 2 to 4 hours per week",
  PAYMENT: "Investment option",
  WHY: "What would make it worth it",
  NOTES: "Anything else",
};
const REQUIRED = ["FIRSTNAME", "EMAIL", "SKILLS", "CHALLENGE", "COMMITMENT", "PAYMENT"];
const MAX_LEN = { FIRSTNAME: 120, EMAIL: 254 };
const DEFAULT_MAX = 2000; // Brevo text attributes hold up to 10,000 characters
const MAX_BODY_BYTES = 30000;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestPost({ request, env }) {
  // 1. read and size-check the body
  let raw;
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: "Could not read the request." }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: "Your answers are too long." }, 413);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // 2. spam trap: real people never fill the hidden "website" field
  if (body.website) return json({ ok: true });

  // 3. clean and validate
  const data = {};
  for (const key of Object.keys(FIELDS)) {
    const max = MAX_LEN[key] || DEFAULT_MAX;
    data[key] = String(body[key] ?? "").trim().slice(0, max);
  }
  for (const key of REQUIRED) {
    if (!data[key]) return json({ ok: false, error: "Please complete all required fields." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.EMAIL)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  // 4. make sure the settings exist
  const listId = Number(env.BREVO_LIST_ID);
  if (!env.BREVO_API_KEY || !Number.isInteger(listId) || listId <= 0) {
    console.error("Missing or invalid BREVO_API_KEY / BREVO_LIST_ID");
    return json({ ok: false, error: "The form is not set up yet." }, 500);
  }

  // 5. create (or update) the contact in Brevo and add it to the list
  const attributes = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "EMAIL" && value) attributes[key] = value; // skip empty answers
  }

  let contactRes;
  try {
    contactRes = await fetch(`${BREVO}/contacts`, {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: data.EMAIL, attributes, listIds: [listId], updateEnabled: true }),
    });
  } catch (err) {
    console.error("Brevo contact request failed", err);
    return json({ ok: false, error: "Could not reach the application system." }, 502);
  }

  // 201 = new contact, 204 = existing contact updated
  if (contactRes.status !== 201 && contactRes.status !== 204) {
    console.error("Brevo contact error", contactRes.status, await contactRes.text());
    return json({ ok: false, error: "Your application could not be saved." }, 502);
  }

  // 6. email the owner a copy of the answers (never blocks the applicant)
  if (env.OWNER_EMAIL && env.SENDER_EMAIL) {
    try {
      const rows = Object.entries(FIELDS)
        .map(([key, label]) => `<p><strong>${esc(label)}</strong><br>${esc(data[key] || "(left blank)").replace(/\n/g, "<br>")}</p>`)
        .join("");
      const mailRes = await fetch(`${BREVO}/smtp/email`, {
        method: "POST",
        headers: { "api-key": env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: { name: env.SENDER_NAME || "Blueprint applications", email: env.SENDER_EMAIL },
          to: [{ email: env.OWNER_EMAIL }],
          replyTo: { email: data.EMAIL, name: data.FIRSTNAME.replace(/[\r\n]/g, " ") },
          subject: `New Blueprint application: ${data.FIRSTNAME.replace(/[\r\n]/g, " ")}`,
          htmlContent: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${rows}</div>`,
        }),
      });
      if (!mailRes.ok) console.error("Brevo notification error", mailRes.status, await mailRes.text());
    } catch (err) {
      console.error("Brevo notification failed", err);
    }
  }

  return json({ ok: true });
}

// Anything other than POST
export const onRequest = () => json({ ok: false, error: "Method not allowed." }, 405);
