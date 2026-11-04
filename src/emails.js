// Branded transactional emails for the Market Perception Build application.
// 3 applicant emails (accept, clarity call, not a fit) plus 1 internal notice to you.
// Email-safe HTML: tables, inline styles, system fonts (Georgia for headings).
import { DECISION_LABEL, REASON_LABEL } from './decide.js';

const C = { ink: '#14100F', bone: '#F5EDE4', fu: '#E4007C', fuDark: '#9d0055', stone: '#E7DCD3' };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const esc = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const firstName = (full) => {
  const f = String(full || '').trim().split(/\s+/)[0] || 'there';
  return f.charAt(0).toUpperCase() + f.slice(1);
};

/* ---------- renderers ---------- */
const para = (t) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">${esc(t)}</p>`;

const linkPara = (lead, label, url) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">${esc(lead)} <a href="${esc(url)}" style="color:${C.fu};font-weight:bold;text-decoration:underline;">${esc(label)}</a>.</p>`;

const steps = (title, items) =>
  `<p style="margin:8px 0 12px;font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:${C.fu};">${esc(title)}</p>` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">` +
  items
    .map(
      (t, i) =>
        `<tr><td valign="top" width="40" style="padding:0 0 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="30" height="30" style="width:30px;height:30px;border-radius:15px;background:${C.fu};color:#ffffff;font-family:${SERIF};font-size:15px;font-weight:bold;">${i + 1}</td></tr></table></td>` +
        `<td valign="middle" style="padding:0 0 12px;font-family:${SANS};font-size:16px;line-height:1.5;color:${C.ink};">${esc(t)}</td></tr>`
    )
    .join('') +
  `</table>`;

const button = (label, url) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px;"><tr><td bgcolor="${C.fu}" style="background:${C.fu};border-radius:10px;border-bottom:4px solid ${C.fuDark};">` +
  `<a href="${esc(url)}" style="display:inline-block;padding:16px 28px;font-family:${SANS};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)} &rarr;</a></td></tr></table>`;

function layout(m, bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(m.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bone};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bone};font-size:1px;line-height:1px;">${esc(m.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.bone}" style="background:${C.bone};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
<tr><td bgcolor="${C.ink}" style="background:${C.ink};padding:22px 32px;border-radius:14px 14px 0 0;font-family:${SERIF};font-size:21px;font-weight:bold;letter-spacing:-0.3px;color:#ffffff;">Brenda Blanche</td></tr>
<tr><td bgcolor="${C.fu}" height="4" style="background:${C.fu};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" style="background:#ffffff;padding:36px 32px 18px;">
<h1 style="margin:0 0 22px;font-family:${SERIF};font-size:32px;line-height:1.1;font-weight:bold;letter-spacing:-0.6px;color:${C.ink};">${esc(m.h[0])} <span style="font-style:italic;font-weight:normal;color:${C.fu};">${esc(m.h[1])}</span></h1>
${bodyHtml}
<p style="margin:8px 0 4px;font-family:${SANS};font-size:16px;line-height:1.5;color:${C.ink};">With care,</p>
<p style="margin:0 0 18px;font-family:${SERIF};font-size:22px;font-weight:bold;color:${C.ink};">Brenda</p>
</td></tr>
<tr><td bgcolor="${C.ink}" style="background:${C.ink};padding:22px 32px;border-radius:0 0 14px 14px;font-family:${SANS};font-size:12px;line-height:1.6;color:#b9b0a6;">
<span style="color:${C.bone};font-weight:bold;">Brand It Unapologetically</span> &middot; Brenda Blanche<br>You are receiving this email because you applied for The Market Perception Build.</td></tr>
</table></td></tr></table></body></html>`;
}

function toText(m) {
  const out = [m.h[0] + ' ' + m.h[1], ''];
  m.paras.forEach((p) => out.push(p, ''));
  if (m.steps) {
    out.push(m.steps.title.toUpperCase());
    m.steps.items.forEach((t, i) => out.push(`${i + 1}. ${t}`));
    out.push('');
  }
  if (m.button) out.push(`${m.button.label}: ${m.button.url}`, '');
  (m.after || []).forEach((p) => out.push(p, ''));
  if (m.link) out.push(`${m.link.lead} ${m.link.label}: ${m.link.url}`, '');
  (m.ps || []).forEach((p) => out.push(p, ''));
  out.push('With care,', 'Brenda', 'Brand It Unapologetically');
  return out.join('\n');
}

function render(m) {
  let body = m.paras.map(para).join('');
  if (m.steps) body += steps(m.steps.title, m.steps.items);
  if (m.button) body += button(m.button.label, m.button.url);
  if (m.after) body += m.after.map(para).join('');
  if (m.link) body += linkPara(m.link.lead, m.link.label, m.link.url);
  if (m.ps) body += m.ps.map(para).join('');
  return { subject: m.subject, html: layout(m, body), text: toText(m) };
}

/* ---------- the 3 applicant emails ---------- */
const NOTFIT_LINES = {
  years:
    'The Build is designed for practitioners with 5+ years of real domain experience, because your offer is built from the proof you already have.',
  sessions:
    'The Build needs you in 2 working sessions and responsive on drafts, and you told me that is not possible right now.',
  invest:
    'You told me the investment is not right for you at the moment, and I respect that.',
};

export function applicantEmail(decision, d, reasons, urls) {
  const first = firstName(d.fullName);

  if (decision === 'accept') {
    return render({
      subject: `You’re a fit for the Market Perception Build, ${first}`,
      preheader: 'Here is how to secure your founding spot.',
      h: ['You’re a fit,', first + '.'],
      paras: [
        'Thank you for applying. I read your answers carefully, and the Market Perception Build is a fit for you.',
        'You already have the experience. The next 14 days are about making your market see it: 1 clear offer, clear positioning and a LinkedIn content system, done for you.',
      ],
      steps: {
        title: 'Here is what happens next',
        items: [
          'Secure your founding spot ($399 USD, paid in full).',
          'Right after payment, you get access to your Client Workspace and Intake Form.',
          'Book Session 1 and we start your 14 days.',
        ],
      },
      button: { label: 'Secure my founding spot', url: urls.selar },
      after: ['There are only 3 founding builds for November, and spots are confirmed in order of payment.'],
      link: { lead: 'Have a question before you pay? Reply to this email, or', label: 'book a 15-minute clarity call', url: urls.clarity },
      ps: [
        'The Build develops your offer, LinkedIn profile and starter content. It does not guarantee leads, clients or revenue. It is backed by the Repeat-Back Guarantee: if your market cannot repeat it back, I rework it with you for free until they can.',
      ],
    });
  }

  if (decision === 'clarity') {
    return render({
      subject: `Let’s talk first, ${first}`,
      preheader: 'A 15-minute clarity call before we decide.',
      h: ['Let’s talk first,', first + '.'],
      paras: [
        'Thank you for applying. I read your answers, and before we decide on the Build, I would like to understand you better.',
        'A 15-minute clarity call lets me hear your situation, ask the right questions and tell you honestly whether the Build is the right move for you now. If it is, we go straight to securing your founding spot. If it is not, I will tell you what I would do instead.',
        'Applying does not commit you to anything.',
      ],
      button: { label: 'Book my 15-minute clarity call', url: urls.clarity },
      after: ['Pick any time that suits you. If none of the times work, reply to this email and we will find one.'],
    });
  }

  const lines = reasons.map((r) => NOTFIT_LINES[r]).filter(Boolean).slice(0, 2);
  const paras = [
    'Thank you for applying, and for answering honestly. After reading your answers, the Market Perception Build is not the right fit for you right now.',
    ...lines,
    'This is not a verdict on your expertise or your potential. The Build is a done-for-you sprint at a pilot rate, so I am strict about who I take, and I would rather tell you the truth than take your money too early.',
    'When things change, you are welcome to apply again.',
  ];
  const m = {
    subject: `About your application, ${first}`,
    preheader: 'An honest answer about the Build.',
    h: ['An honest answer,', first + '.'],
    paras,
  };
  if (urls.scorecard) {
    m.after = ['In the meantime, the free Market Translation Scorecard is a quick way to see how clearly your market understands what you do.'];
    m.button = { label: 'Take the free Scorecard', url: urls.scorecard };
    // keep order natural: intro line before the button
    m.paras = [...paras.slice(0, -1), paras[paras.length - 1], m.after[0]];
    delete m.after;
  }
  return render(m);
}

/* ---------- internal notice to you ---------- */
export function ownerNotice(decision, d, reasons, applicantSent) {
  const rows = [
    ['Decision', DECISION_LABEL[decision] + (reasons.length ? ' (' + reasons.map((r) => REASON_LABEL[r] || r).join('; ') + ')' : '')],
    ['Applicant email sent', applicantSent ? 'Yes' : 'NO, check Brevo sender settings'],
    ['Name', d.fullName],
    ['Email', d.email],
    ['LinkedIn', d.linkedin],
    ['Work', d.serviceWork],
    ['Experience', d.years],
    ['Situation', d.situation],
    ['Wants help with', (d.wantsHelp || []).join(' | ')],
    ['Gets clients via', (d.clientSources || []).join(' | ')],
    ['Sessions and drafts', d.sessionsReady],
    ['Ready to invest $399', d.investReady],
    ['Notes', d.notes || '-'],
  ];
  const html =
    `<div style="font-family:${SANS};color:${C.ink};max-width:620px;"><h2 style="font-family:${SERIF};margin:0 0 14px;">New Build application: <span style="color:${C.fu};">${esc(DECISION_LABEL[decision])}</span></h2>` +
    `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0 6px;">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td valign="top" width="170" style="padding:8px 12px;background:${C.stone};font-size:13px;font-weight:bold;border-radius:8px 0 0 8px;">${esc(k)}</td><td valign="top" style="padding:8px 12px;background:${C.bone};font-size:14px;line-height:1.5;border-radius:0 8px 8px 0;">${esc(v)}</td></tr>`
      )
      .join('') +
    `</table><p style="font-size:12px;color:#6b625a;">Reply to this email to answer the applicant directly.</p></div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  return { subject: `New Build application: ${DECISION_LABEL[decision]}: ${d.fullName}`, html, text };
}
