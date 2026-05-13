// supabase/functions/day-after-notifications/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// ─── Filtering config — tune these to control volume ─────────────────────────

// Max notifications queued in a single run (across all people)
const MAX_PER_DAY = 3;

// Per-person cooldown in days
const COOLDOWN_DAYS = 7;

// For "friend" tier — only follow up if last touchpoint was this many days ago
const FRIEND_SILENCE_THRESHOLD_DAYS = 30;

// Event types that ALWAYS get a follow-up (regardless of tier)
const HIGH_VALUE_EVENT_TYPES = ["birthday", "anniversary", "milestone"];

// Event types that get a follow-up only for close/family
const CLOSE_ONLY_EVENT_TYPES = ["visit", "appointment"];

// Event types that never get a follow-up
const SKIP_EVENT_TYPES = ["other"];

// Tiers that NEVER get automated follow-ups
const SKIP_TIERS = ["acquaintance"];

// On weekends, only notify for these tiers
const WEEKEND_ALLOWED_TIERS = ["family", "close"];

// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Person {
  id: string;
  name: string;
  relationship_tier: "close" | "family" | "friend" | "acquaintance" | null;
}

interface CalendarEvent {
  id: string;
  household_id: string;
  title: string;
  event_type: "birthday" | "anniversary" | "appointment" | "visit" | "milestone" | "other";
  event_date: string;
  follow_up_enabled: boolean;
  people: Person | null;
}

interface RelationshipLog {
  touchpoint_type: string;
  logged_at: string;
  note: string | null;
}

interface NotificationResult {
  copy: string;
  action_labels: string[];
  tone_note: string;
}

// ─── Smart filter ─────────────────────────────────────────────────────────────

function shouldNotify(
  event: CalendarEvent,
  person: Person,
  lastLog: RelationshipLog | null,
  isWeekend: boolean
): { notify: boolean; reason: string } {

  const tier = person.relationship_tier ?? "friend";
  const eventType = event.event_type;

  // Never notify for skipped tiers
  if (SKIP_TIERS.includes(tier)) {
    return { notify: false, reason: `tier=${tier} is in skip list` };
  }

  // Never notify for skipped event types
  if (SKIP_EVENT_TYPES.includes(eventType)) {
    return { notify: false, reason: `event_type=${eventType} is in skip list` };
  }

  // Weekend gate — only family/close on weekends
  if (isWeekend && !WEEKEND_ALLOWED_TIERS.includes(tier)) {
    return { notify: false, reason: `weekend + tier=${tier}` };
  }

  // High-value events always notify
  if (HIGH_VALUE_EVENT_TYPES.includes(eventType)) {
    return { notify: true, reason: `high-value event: ${eventType}` };
  }

  // Close-only events
  if (CLOSE_ONLY_EVENT_TYPES.includes(eventType)) {
    if (!["family", "close"].includes(tier)) {
      return { notify: false, reason: `${eventType} only for family/close` };
    }
    return { notify: true, reason: `${eventType} + tier=${tier}` };
  }

  // Friend tier — only if they've gone quiet
  if (tier === "friend") {
    if (!lastLog) {
      return { notify: true, reason: "friend + no contact on record" };
    }
    const daysSince = Math.floor(
      (Date.now() - new Date(lastLog.logged_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince < FRIEND_SILENCE_THRESHOLD_DAYS) {
      return { notify: false, reason: `friend + last contact ${daysSince}d ago` };
    }
    return { notify: true, reason: `friend + ${daysSince}d since last contact` };
  }

  // family/close — always notify
  return { notify: true, reason: `tier=${tier}` };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (_req) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log(`[day-after] ${yesterdayStr} | weekend=${isWeekend}`);

    const { data: events, error: eventsError } = await supabase
      .from("calendar_events")
      .select(`
        id, household_id, title, event_type, event_date, follow_up_enabled,
        people:people_id ( id, name, relationship_tier )
      `)
      .eq("follow_up_enabled", true)
      .gte("event_date", `${yesterdayStr}T00:00:00`)
      .lte("event_date", `${yesterdayStr}T23:59:59`)
      .not("people_id", "is", null);

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let queued = 0;
    let skipped = 0;

    for (const event of events as CalendarEvent[]) {
      if (queued >= MAX_PER_DAY) { skipped++; continue; }

      const person = event.people;
      if (!person) continue;

      // Cooldown check
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() - COOLDOWN_DAYS);
      const { data: recentNotif } = await supabase
        .from("notification_queue")
        .select("id")
        .eq("people_id", person.id)
        .eq("notification_type", "day_after_followup")
        .gte("scheduled_for", cooldownDate.toISOString())
        .limit(1)
        .maybeSingle();

      if (recentNotif) { skipped++; continue; }

      // Last touchpoint for context
      const { data: lastLog } = await supabase
        .from("relationship_log")
        .select("touchpoint_type, logged_at, note")
        .eq("people_id", person.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle() as { data: RelationshipLog | null };

      // Smart filter
      const { notify, reason } = shouldNotify(event, person, lastLog, isWeekend);
      if (!notify) {
        console.log(`[day-after] Skip ${person.name} — ${reason}`);
        skipped++;
        continue;
      }

      console.log(`[day-after] Queue ${person.name} (${event.event_type}) — ${reason}`);

      // Generate copy
      let notifData: NotificationResult;
      try {
        notifData = await generateNotificationCopy({
          personName: person.name,
          eventType: event.event_type,
          eventTitle: event.title,
          tier: person.relationship_tier,
          lastTouchpoint: lastLog
            ? { type: lastLog.touchpoint_type, date: lastLog.logged_at, note: lastLog.note }
            : null,
        });
      } catch {
        notifData = fallbackCopy(person.name, event.event_type, event.title);
      }

      const { error: insertError } = await supabase
        .from("notification_queue")
        .insert({
          household_id: event.household_id,
          people_id: person.id,
          event_id: event.id,
          notification_type: "day_after_followup",
          generated_copy: notifData.copy,
          action_labels: notifData.action_labels,
          status: "pending",
          scheduled_for: new Date().toISOString(),
        });

      if (!insertError) queued++;
    }

    console.log(`[day-after] queued=${queued} skipped=${skipped}`);
    return new Response(
      JSON.stringify({ processed: events.length, queued, skipped }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[day-after] Fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

// ─── AI copy generation ───────────────────────────────────────────────────────

interface GenerateParams {
  personName: string;
  eventType: string;
  eventTitle: string;
  tier: string | null;
  lastTouchpoint: { type: string; date: string; note: string | null } | null;
}

async function generateNotificationCopy(params: GenerateParams): Promise<NotificationResult> {
  const { personName, eventType, eventTitle, tier, lastTouchpoint } = params;

  const tierLabel = tier ?? "friend";
  const lastTouchStr = lastTouchpoint
    ? `Last touchpoint: ${lastTouchpoint.type} on ${new Date(lastTouchpoint.date).toLocaleDateString("en-US", { month: "long", day: "numeric" })}${lastTouchpoint.note ? ` — "${lastTouchpoint.note}"` : ""}.`
    : "No recent touchpoints on record.";

  const systemPrompt = `You are Ripple, a warm AI assistant in a family home management app called Anchor & Flow. Write gentle follow-up notification copy that feels like a caring friend noticing something — not a CRM reminder.

VOICE RULES:
- One sentence max. Warm, specific, never robotic.
- Never say "reminder", "don't forget", or "task".
- Always use the person's first name.
- Reference specific context when available.
- Tier warmth: family/close = most personal; friend = warm but light.
- Appointments → follow-up care focus. Visits → thank-you nudge. Milestones → celebratory.

Return only valid JSON, no markdown:
{ "copy": "one warm sentence", "action_labels": ["Primary", "Secondary", "Skip"], "tone_note": "word" }

Action labels: 2–4 max. Last = always "Skip" or "All good".`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: `Person: ${personName}\nTier: ${tierLabel}\nEvent type: ${eventType}\nEvent: "${eventTitle}"\n${lastTouchStr}` }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API ${response.status}`);
  const data = await response.json();
  const clean = (data.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as NotificationResult;
}

// ─── Fallback templates ───────────────────────────────────────────────────────

function fallbackCopy(name: string, eventType: string, title: string): NotificationResult {
  const t: Record<string, NotificationResult> = {
    birthday:    { copy: `Yesterday was ${name}'s birthday — did you get a chance to reach out?`,   action_labels: ["Called", "Texted", "Sent a gift", "Skip"], tone_note: "gentle"      },
    anniversary: { copy: `${name}'s anniversary was yesterday — a quick message would mean a lot.`, action_labels: ["Reached out", "Skip"],                    tone_note: "warm"        },
    milestone:   { copy: `${name} had a big milestone yesterday — did you get to celebrate?`,        action_labels: ["Reached out", "Skip"],                    tone_note: "celebratory" },
    appointment: { copy: `${name} had an appointment yesterday. Any follow-up care to log?`,         action_labels: ["Log notes →", "All clear"],               tone_note: "practical"   },
    visit:       { copy: `You had "${title}" yesterday — want to send a quick thank-you?`,          action_labels: ["Draft thank-you ↗", "Already sent", "Skip"], tone_note: "warm"     },
  };
  return t[eventType] ?? { copy: `Yesterday you had "${title}" with ${name} — anything worth noting?`, action_labels: ["Log note →", "All good"], tone_note: "neutral" };
}
