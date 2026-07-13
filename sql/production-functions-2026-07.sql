pg_get_functiondef
"CREATE OR REPLACE FUNCTION public.action_notification(notif_id uuid, action text, log_touchpoint boolean DEFAULT true, touchpoint_type text DEFAULT NULL::text, snooze_hours integer DEFAULT 24)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_notif notification_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_notif FROM notification_queue WHERE id = notif_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = v_notif.household_id::text AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not a member of this household';
  END IF;
  IF action = 'snoozed' THEN
    UPDATE notification_queue SET status = 'snoozed', snoozed_until = now() + (snooze_hours || ' hours')::INTERVAL, actioned_at = now(), action_taken = action WHERE id = notif_id;
  ELSIF action = 'dismissed' THEN
    UPDATE notification_queue SET status = 'dismissed', actioned_at = now(), action_taken = action WHERE id = notif_id;
  ELSE
    UPDATE notification_queue SET status = 'actioned', actioned_at = now(), action_taken = action WHERE id = notif_id;
  END IF;
  IF log_touchpoint AND v_notif.person_name IS NOT NULL AND action NOT IN ('dismissed','snoozed') THEN
    INSERT INTO relationship_log (household_id, person_name, person_local_id, event_type, touchpoint_type, ai_suggested) VALUES (v_notif.household_id, v_notif.person_name, v_notif.person_local_id, v_notif.notification_type, COALESCE(touchpoint_type, action), true);
  END IF;
END;
$function$
"
"CREATE OR REPLACE FUNCTION public.exhale_delete_card(p_id text, p_household_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ BEGIN IF NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = p_household_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'not a member of this household'; END IF; DELETE FROM exhale_cards WHERE id = p_id AND household_id = p_household_id; RETURN p_id; END; $function$
"
"CREATE OR REPLACE FUNCTION public.exhale_move_card(p_id text, p_household_id text, p_category text, p_position numeric, p_updated_by text)
 RETURNS exhale_cards
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE v_row exhale_cards; BEGIN IF NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = p_household_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'not a member of this household'; END IF; UPDATE exhale_cards SET category = p_category, position = p_position, updated_by = NULLIF(p_updated_by, '')::uuid WHERE id = p_id AND household_id = p_household_id RETURNING * INTO v_row; RETURN v_row; END; $function$
"
"CREATE OR REPLACE FUNCTION public.exhale_update_card(p_id text, p_household_id text, p_text text, p_notes text, p_color text, p_emoji text, p_due_date date, p_assigned_to text, p_updated_by text)
 RETURNS exhale_cards
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ DECLARE v_row exhale_cards; BEGIN IF NOT EXISTS (SELECT 1 FROM household_members WHERE household_id = p_household_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'not a member of this household'; END IF; UPDATE exhale_cards SET updated_by = NULLIF(p_updated_by, '')::uuid, text = p_text, notes = p_notes, color = p_color, emoji = p_emoji, due_date = p_due_date, assigned_to = p_assigned_to WHERE id = p_id AND household_id = p_household_id RETURNING * INTO v_row; RETURN v_row; END; $function$
"
"CREATE OR REPLACE FUNCTION public.get_pending_notifications()
 RETURNS TABLE(id uuid, person_name text, person_local_id text, notification_type text, generated_copy text, action_labels text[], scheduled_for timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, person_name, person_local_id, notification_type, generated_copy, action_labels, scheduled_for
  FROM notification_queue
  WHERE status = 'pending'
    AND scheduled_for <= now()
    AND household_id::text IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  ORDER BY scheduled_for ASC;
$function$
"
"CREATE OR REPLACE FUNCTION public.join_household(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_exists boolean;
BEGIN
  -- Must be authenticated
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in.');
  END IF;

  -- Does the household exist? (elevated rights bypass the member-only read policy)
  SELECT EXISTS(SELECT 1 FROM households WHERE id = p_code) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Household not found. Check the code and try again.');
  END IF;

  -- Add caller as a member (idempotent — re-joining is harmless)
  INSERT INTO household_members (household_id, user_id, role)
  VALUES (p_code, v_uid, 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'household_id', p_code);
END;
$function$
"
"CREATE OR REPLACE FUNCTION public.merge_household_data(p_household_id text, p_patch jsonb, p_updated_by text DEFAULT NULL::text)
 RETURNS TABLE(merged_at timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
begin
  return query
  update public.households h
     set data       = coalesce(h.data, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb),
         updated_at = now(),
         updated_by = coalesce(p_updated_by, h.updated_by)
   where h.id = p_household_id
  returning h.updated_at;
end;
$function$
"
"CREATE OR REPLACE FUNCTION public.shopping_add_item(p_id text, p_household_id text, p_text text, p_store text, p_category text, p_photo text, p_created_by text)
 RETURNS SETOF shopping_items
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ insert into public.shopping_items (id, household_id, text, store, done, category, photo, position, created_by, updated_by, updated_at) select p_id, p_household_id, p_text, coalesce(nullif(p_store,''),'Grocery'), false, coalesce(p_category,''), nullif(p_photo,''), coalesce((select max(position) from public.shopping_items where household_id=p_household_id),0)+1, nullif(p_created_by,'')::uuid, nullif(p_created_by,'')::uuid, now() where exists (select 1 from public.household_members where household_id=p_household_id and user_id=auth.uid()) on conflict (id) do nothing returning *; $function$
"
"CREATE OR REPLACE FUNCTION public.shopping_delete_item(p_id text, p_household_id text, p_updated_by text)
 RETURNS SETOF shopping_items
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ delete from public.shopping_items where id=p_id and household_id=p_household_id and exists (select 1 from public.household_members where household_id=p_household_id and user_id=auth.uid()) returning *; $function$
"
"CREATE OR REPLACE FUNCTION public.shopping_toggle_item(p_id text, p_household_id text, p_done boolean, p_updated_by text)
 RETURNS SETOF shopping_items
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ update public.shopping_items set done=p_done, updated_by=nullif(p_updated_by,'')::uuid, updated_at=now() where id=p_id and household_id=p_household_id and exists (select 1 from public.household_members where household_id=p_household_id and user_id=auth.uid()) returning *; $function$
"
"CREATE OR REPLACE FUNCTION public.shopping_update_item(p_id text, p_household_id text, p_text text, p_store text, p_category text, p_photo text, p_updated_by text)
 RETURNS SETOF shopping_items
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ update public.shopping_items set text=p_text, store=coalesce(nullif(p_store,''),'Grocery'), category=coalesce(p_category,''), photo=nullif(p_photo,''), updated_by=nullif(p_updated_by,'')::uuid, updated_at=now() where id=p_id and household_id=p_household_id and exists (select 1 from public.household_members where household_id=p_household_id and user_id=auth.uid()) returning *; $function$
"
"CREATE OR REPLACE FUNCTION public.update_cove_lists_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
"