import webpush from 'web-push';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET   = process.env.CRON_SECRET;

const NOTIF_SCHEDULE = {
  7:  { type: 'morning', title: 'Good morning ⚓️' },
  12: { type: 'midday',  title: '🌊 Midday check-in' },
  15: { type: 'dinner',  title: '🍽️ Dinner heads-up' },
  17: { type: 'evening', title: '🌙 Evening recap' },
};

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:hello@anchorandflowapp.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function sbFetch(path, opts = {}) {
  const res = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function generateMessage(system, userContent, fallback) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 160,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    const d = await res.json();
    return d.content?.find(b => b.type === 'text')?.text?.trim() || fallback;
  } catch { return fallback; }
}

function getETHour() {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const isDST = month > 3 && month < 11;
  return (now.getUTCHours() - (isDST ? 4 : 5) + 24) % 24;
}

function getDayName() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const isDST = month > 3 && month < 11;
  return days[new Date(now.getTime() - (isDST ? 4 : 5) * 3600000).getDay()];
}

function getTodayET() {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const isDST = month > 3 && month < 11;
  return new Date(now.getTime() - (isDST ? 4 : 5) * 3600000).toISOString().split('T')[0];
}

function buildContext(data, type) {
  const fp = data.familyProfile || {};
  const today = getDayName();
  const tasks = (data.tasks || []).filter(t => (t.day === today || t.day === 'Daily') && !t.archived);
  const done = tasks.filter(t => t.done);
  const pending = tasks.filter(t => !t.done);
  const todayMeal = ((data.meals || {})[today] || {}).dinner || '';
  const events = (data.calEvents || []).filter(e => e.date === getTodayET());
  const rhythm = ((data.rhythm || {})[today] || {});
  const base = [
    `Family: ${fp.parentNames || 'not set'}, ${fp.numKids || '?'} kids (ages ${fp.kidAges || 'unknown'})`,
    `Work: ${fp.workSituation || 'not set'}`,
    `Today: ${today}, theme: ${rhythm.theme || 'none'}`,
    `Events: ${events.map(e => (e.time || 'all day') + ' ' + e.title).join(', ') || 'none'}`,
    `Dinner: ${todayMeal || 'not planned'}`,
    `Tasks done: ${done.length}, pending: ${pending.map(t => t.text).slice(0, 5).join(', ') || 'none'}`,
  ].join('. ');
  const prompts = {
    morning: `${base}. Write a warm good-morning Ripple notification (max 180 chars). Mention 1-2 key things from today. Encouraging personal tone.`,
    midday:  `${base}. Write a friendly midday check-in (max 180 chars). Acknowledge done tasks, mention what's ahead.`,
    dinner:  `${base}. Write a 3pm dinner heads-up (max 140 chars). Mention dinner and one prep step.`,
    evening: `${base}. Write a warm 5pm evening recap (max 180 chars). Celebrate wins, preview tomorrow.`,
  };
  return prompts[type] || base;
}

export default async function handler(req, res) {
  // Allow Authorization header (cron jobs) OR ?secret= query param (manual testing)
  const authHeader = req.headers['authorization'];
  const querySecret = req.query?.secret;
  const authorized = !CRON_SECRET
    || authHeader === `Bearer ${CRON_SECRET}`
    || querySecret === CRON_SECRET;

  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  const etHour = getETHour();
  const notifType = req.query?.type || NOTIF_SCHEDULE[etHour]?.type;
  if (!notifType) return res.status(200).json({ skipped: true, reason: `No notification scheduled for ET hour ${etHour}` });

  const notifMeta = Object.values(NOTIF_SCHEDULE).find(n => n.type === notifType);

  try {
    const subscriptions = await sbFetch('/rest/v1/push_subscriptions?select=id,endpoint,subscription_json,household_id&limit=200');
    if (!subscriptions.length) return res.status(200).json({ sent: 0, reason: 'No subscriptions found' });

    const uniqueHHIds = [...new Set(subscriptions.map(s => s.household_id).filter(Boolean))];
    const householdMap = {};
    await Promise.all(uniqueHHIds.map(async (hhId) => {
      try {
        const rows = await sbFetch(`/rest/v1/households?id=eq.${hhId}&select=id,data&limit=1`);
        if (rows[0]) householdMap[hhId] = rows[0].data || {};
      } catch {}
    }));

    const results = { sent: 0, skipped: 0, failed: 0, errors: [] };

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        const hhData = householdMap[sub.household_id] || {};
        if ((hhData.notifSettings || {})[notifType] === false) { results.skipped++; return; }

        const body = await generateMessage(
          'You are Ripple, the warm AI companion in Anchor & Flow. Write a short push notification. Warm, personal, practical. Max 180 chars. No quotes or hashtags.',
          buildContext(hhData, notifType),
          notifType === 'morning' ? 'Good morning ⚓️ Your day is set up and ready.' :
          notifType === 'midday'  ? 'Midday check-in 🌊 Keep going — you\'re doing great.' :
          notifType === 'dinner'  ? '🍽️ Time to think about dinner!' :
          '🌙 Great work today. Rest up for tomorrow.'
        );

        await webpush.sendNotification(JSON.parse(sub.subscription_json), JSON.stringify({
          title: notifMeta?.title || 'Ripple ⚓️',
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          data: { type: notifType, url: '/' },
        }));

        results.sent++;
      } catch (e) {
        results.failed++;
        results.errors.push(e.message?.slice(0, 100));
        if (e.statusCode === 410 || e.statusCode === 404) {
          try { await sbFetch(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' }); } catch {}
        }
      }
    }));

    return res.status(200).json({ ok: true, type: notifType, etHour, ...results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
