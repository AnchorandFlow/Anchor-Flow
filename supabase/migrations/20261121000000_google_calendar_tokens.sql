-- Google Calendar: one row per signed-in user holding their Google refresh
-- token, encrypted (AES-GCM; the key lives only in the google-calendar Edge
-- Function's secrets as GCAL_TOKEN_KEY).
--
-- Row Level Security is on with NO policies, and the browser roles have no
-- grants: nothing in the app can read or write this table directly. Only the
-- google-calendar Edge Function (service role) touches it, and it always
-- scopes to the caller's verified user id. The refresh token never leaves the
-- server; the browser only ever receives short-lived access tokens.
create table if not exists public.google_calendar_tokens (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  account_email     text,
  refresh_token_enc text not null,
  scope             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

revoke all on table public.google_calendar_tokens from anon, authenticated;
