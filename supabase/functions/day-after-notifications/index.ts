// supabase/functions/day-after-notifications/index.ts
// Schedule via pg_cron: SELECT cron.schedule('day-after-notifications', '0 8 * * *',
//   'SELECT net.http_post(''https://<project>.supabase.co/functions/v1/day-after-notifications'',
//   headers := ''{"Authorization": "Bearer <service_role_key>"}'')');

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

// How many days back to look (1 = yesterday)
const LOOKBACK_DAYS = 1;
// Cooldown: don't re-notify for the same person within this many days
const COOLDOWN_DAYS = 7;
// Quiet hours: only deliver between these hours (user's local time via household timezone)
const DELIVERY_HOUR = 8;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (_req) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - LOOKBACK_DAYS);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    console.log(`[day-after] Running for date: ${yesterdayStr}`);

    // 1. Fetch yesterday's events with linked people
    const { data: events, error: eventsError } = await supabase
      .from("calendar_events")
      .select(`
        id,
        household_id,
        title,
        event_type,
        event_date,
        follow_up_enabled,
        people:people_id (
          id,
          name,
          relationship_tier
        )
      `)
      .eq("follow_up_enabled", true)
      .gte("event_date", `${yesterdayStr}T00:00:00`)
      .lte("event_date", `${yesterdayStr}T23:59:59`)
      .not("people_id", "is", null);

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      console.log("[day-after] No qualifying events yesterday.");
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    console.log(`[day-after] Found ${events.length} qualifying events.`);

    let queued = 0;
    let skipped = 0;

    for (const event of events as CalendarEvent[]) {
      const person = event.people;
      if (!person) continue;

      // 2. Cooldown check — skip if already notified for this person recently
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

      if (recentNotif) {
        console.log(`[day-after] Skipping ${person.name} — cooldown active.`);
        skipped++;
        continue;
      }

      // 3. Fetch relationship context — last touchpoint
      const { data: lastLog } = await supabase
        .from("relationship_log")
        .select("touchpoint_type, logged_at, note")
        .eq("people_id", person.id)
        .order("logged_at", { ascending: false })
        .limit(1)
        .maybeSingle() as { data: RelationshipLog | null };

      // 4. Generate notification copy via Anthropic
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
      } catch (aiErr) {
        console.error(`[day-after] AI generation failed for ${person.name}:`, aiErr);
        // Fall back to template copy
        notifData = fallbackCopy(person.name, event.event_type, event.title);
      }

      // 5. Insert into notification_queue
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

      if (insertError) {
        console.error(`[day-after] Insert failed for ${person.name}:`, insertError);
        continue;
      }

      console.log(`[day-after] Queued notification for ${person.name} (${event.event_type}).`);
      queued++;
    }

    return new Response(
      JSON.stringify({ processed: events.length, queued, skipped }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[day-after] Fatal error:", err);
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

  const systemPrompt = `You are Ripple, a warm and thoughtful AI assistant inside a family home management app called Anchor & Flow. Your job is to write gentle follow-up notification copy that feels like a caring friend noticing something, not a CRM reminding the user of a task.

VOICE RULES:
- One sentence max for the main copy. Warm, specific, never robotic.
- Never use the word "reminder", "don't forget", or "task".
- Always use the person's first name.
- Reference specific context (last contact date, gift history, relationship) when available.
- Adjust warmth by tier: family/close = most personal; friend = warm but lighter; acquaintance = gentle nudge only.
- For appointments (vet, doctor, dentist), focus on follow-up care, not the relationship.
- For visits/social events, suggest a thank-you or check-in.
- For missed events, offer empathy and a graceful way to reach out.

RESPONSE FORMAT: Return only valid JSON — no markdown, no preamble.
{
  "copy": "one warm sentence",
  "action_labels": ["Primary action", "Secondary action", "Tertiary action"],
  "tone_note": "one-word tone descriptor used"
}

Action label rules: 2–4 labels max. First label should be the most natural primary action (e.g. "Called her", "Texted", "Sent a gift"). Always include "Skip" or "All good" as the last option.`;

  const userPrompt = `Generate a day-after follow-up notification.

Person: ${personName}
Relationship tier: ${tierLabel}
Event type: ${eventType}
Event title: "${eventTitle}"
${lastTouchStr}`;

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
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? "";

  // Strip any accidental markdown fences
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as NotificationResult;
}

// ─── Fallback templates (if AI call fails) ────────────────────────────────────

function fallbackCopy(name: string, eventType: string, title: string): NotificationResult {
  const templates: Record<string, NotificationResult> = {
    birthday: {
      copy: `Yesterday was ${name}'s birthday — did you get a chance to reach out?`,
      action_labels: ["Called", "Texted", "Sent a gift", "Skip"],
      tone_note: "gentle",
    },
    anniversary: {
      copy: `${name}'s anniversary was yesterday — a quick message would mean a lot.`,
      action_labels: ["Reached out", "Skip"],
      tone_note: "warm",
    },
    appointment: {
      copy: `${name} had an appointment yesterday ("${title}"). Any follow-up care to log?`,
      action_labels: ["Log notes →", "All clear"],
      tone_note: "practical",
    },
    visit: {
      copy: `You had "${title}" yesterday — want to send a quick thank-you?`,
      action_labels: ["Draft a thank-you ↗", "Already sent one", "Skip"],
      tone_note: "warm",
    },
  };

  return (
    templates[eventType] ?? {
      copy: `Yesterday you had "${title}" with ${name} — anything to follow up on?`,
      action_labels: ["Log note →", "All good"],
      tone_note: "neutral",
    }
  );
}
