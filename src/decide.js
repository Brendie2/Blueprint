// ROUTING RULES for the Market Perception Build application.
// Edit this file to change who is accepted, invited to a clarity call, or declined.
//
// Result: { decision: 'accept' | 'clarity' | 'notfit', reasons: [keys] }
//
// 1. NOT A FIT  (any 1 of these)
//    - years: "Less than 5 years"        (the Build needs 5+ years of real domain experience)
//    - sessions: "Not right now."        (cannot attend the working sessions / review drafts)
//    - invest: "Not right now."          (not ready to invest at the $399 founding rate)
// 2. CLARITY CALL  (not declined, but any 1 of these)
//    - sessions: "Yes, but I have some availability constraints."
//    - invest: "I have a few questions before deciding."
//    - situation: moving from employment, or running another type of B2B service business
//    - wantsHelp includes "I'm not sure where to start."
//    - clientSources includes "I haven't started getting independent clients yet."
// 3. ACCEPT  (everything else)

const has = (list, re) => Array.isArray(list) && list.some((x) => re.test(String(x)));

export function decide(d) {
  const years = String(d.years || '');
  const sessions = String(d.sessionsReady || '');
  const invest = String(d.investReady || '');
  const situation = String(d.situation || '');

  const notFit = [];
  if (/^less than 5/i.test(years)) notFit.push('years');
  if (/^not right now/i.test(sessions)) notFit.push('sessions');
  if (/^not right now/i.test(invest)) notFit.push('invest');
  if (notFit.length) return { decision: 'notfit', reasons: notFit };

  const clarity = [];
  if (/^yes, but/i.test(sessions)) clarity.push('availability');
  if (/few questions/i.test(invest)) clarity.push('questions');
  if (/moving from employment/i.test(situation)) clarity.push('transition');
  if (/another type of b2b/i.test(situation)) clarity.push('othertype');
  if (has(d.wantsHelp, /not sure where to start/i)) clarity.push('unsure');
  if (has(d.clientSources, /haven.t started/i)) clarity.push('noclients');
  if (clarity.length) return { decision: 'clarity', reasons: clarity };

  return { decision: 'accept', reasons: [] };
}

export const DECISION_LABEL = {
  accept: 'ACCEPT',
  clarity: 'CLARITY CALL',
  notfit: 'NOT A FIT',
};

export const REASON_LABEL = {
  years: 'Less than 5 years of experience',
  sessions: 'Cannot attend sessions or review drafts right now',
  invest: 'Not ready to invest right now',
  availability: 'Has availability constraints',
  questions: 'Has questions before deciding on the investment',
  transition: 'Moving from employment into consulting',
  othertype: 'Runs another type of B2B service business',
  unsure: 'Not sure where to start',
  noclients: 'Has not started getting independent clients yet',
};
