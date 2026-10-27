/** Dormant until an explicitly approved group is enrolled. No historical replay. */
export const STATUS_LIST_SERVICE_SCHEMA = `
CREATE TABLE IF NOT EXISTS mission_callback_groups (
 campaign_id varchar PRIMARY KEY REFERENCES campaigns(id),
 fingerprint text NOT NULL,
 converter text NOT NULL,
 actions jsonb NOT NULL,
 owner text NOT NULL DEFAULT 'legacy' CHECK(owner IN ('legacy','service')),
 enrolled boolean NOT NULL DEFAULT false,
 generation integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mission_callback_approvals (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
 campaign_id varchar NOT NULL REFERENCES mission_callback_groups(campaign_id),
 fingerprint text NOT NULL,
 generation integer NOT NULL,
 target text NOT NULL CHECK(target IN ('enroll','legacy','service')),
 approved_by varchar NOT NULL,
 backup_reference text NOT NULL CHECK(length(trim(backup_reference))>0),
 evidence jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz
);
CREATE TABLE IF NOT EXISTS mission_callback_service_events (
 id bigserial PRIMARY KEY,
 campaign_id varchar NOT NULL REFERENCES mission_callback_groups(campaign_id),
 campaign_contact_id varchar NOT NULL,
 event_id text NOT NULL,
 action_id varchar NOT NULL,
 owner text NOT NULL CHECK(owner IN ('legacy','service')),
 generation integer NOT NULL,
 actor_id varchar NOT NULL,
 occurred_at timestamptz NOT NULL,
 payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','done','blocked')),
 result jsonb,
 attempts integer NOT NULL DEFAULT 0,
 UNIQUE(campaign_id,campaign_contact_id,event_id,action_id)
);
CREATE INDEX IF NOT EXISTS mission_callback_service_events_pending
 ON mission_callback_service_events(id) WHERE state='pending';
CREATE TABLE IF NOT EXISTS mission_callback_cutovers (
 id bigserial PRIMARY KEY,
 campaign_id varchar NOT NULL,
 approval_id varchar NOT NULL UNIQUE REFERENCES mission_callback_approvals(id),
 fingerprint text NOT NULL,
 from_owner text NOT NULL,
 to_owner text NOT NULL,
 generation integer NOT NULL,
 actor_id varchar NOT NULL,
 event_boundary bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS mission_callback_baselines (
 campaign_id varchar NOT NULL REFERENCES mission_callback_groups(campaign_id),
 state_id varchar NOT NULL,
 PRIMARY KEY(campaign_id,state_id)
);
CREATE OR REPLACE FUNCTION mission_callback_enqueue(state_id text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g record; a jsonb; cc record; raw record; n integer; missing boolean; ctx jsonb; df text; s record; entity_id text;
BEGIN
 SELECT * INTO s FROM campaign_contact_status_list_state WHERE id=state_id;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT c.* INTO cc FROM campaign_contacts c WHERE c.id=s.campaign_contact_id;
 ctx:=coalesce(nullif(current_setting('indexus.callback_context',true),''),'{}')::jsonb;
 IF ctx->>'admitted' IS DISTINCT FROM 'true' THEN
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('mission-callback-admission:'||cc.campaign_id,0));
 END IF;
 -- Serialize capture with every other producer and the worker, not just UPDATE.
 -- Sequence allocation alone does not impose commit order across transactions.
 PERFORM pg_advisory_xact_lock(hashtextextended('mission-callback-contact:'||cc.id,0));
 SELECT * INTO g FROM mission_callback_groups WHERE campaign_id=cc.campaign_id AND enrolled FOR SHARE;
 IF NOT FOUND THEN RETURN; END IF;
 IF ctx->>'skip'='true' THEN
  INSERT INTO mission_callback_baselines VALUES(cc.campaign_id,s.id) ON CONFLICT DO NOTHING;
  RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM mission_callback_baselines b WHERE b.campaign_id=cc.campaign_id AND b.state_id=s.id) THEN RETURN; END IF;
 -- Background baseline writes and unchained answer changes must never replay effects.
 IF ctx->>'suppress'='true' THEN RETURN; END IF;
 entity_id:=CASE cc.contact_type WHEN 'clinic' THEN coalesce(cc.clinic_id,cc.customer_id)
  WHEN 'hospital' THEN coalesce(cc.hospital_id,cc.customer_id)
  WHEN 'collaborator' THEN coalesce(cc.collaborator_id,cc.customer_id)
  ELSE cc.customer_id END;
 n:=NULL;
 IF entity_id IS NOT NULL THEN
  -- customer_id historically carries the called entity id, including facilities.
  -- New logs may instead have only an exact Mission-contact link. Include every
  -- Mission for this entity, never just the selected Mission or failed attempts.
  -- EXISTS/OR counts a log carrying both links once, not once per enrollment.
  SELECT count(*) INTO n FROM call_logs cl
  WHERE cl.customer_id=entity_id OR EXISTS(
   SELECT 1 FROM campaign_contacts linked WHERE linked.id=cl.campaign_contact_id
    AND linked.contact_type IS NOT DISTINCT FROM cc.contact_type
    AND (CASE linked.contact_type
     WHEN 'clinic' THEN coalesce(linked.clinic_id,linked.customer_id)
     WHEN 'hospital' THEN coalesce(linked.hospital_id,linked.customer_id)
     WHEN 'collaborator' THEN coalesce(linked.collaborator_id,linked.customer_id)
     ELSE linked.customer_id END)=entity_id
  );
 END IF;
 FOR a IN SELECT value FROM jsonb_array_elements(g.actions) LOOP
  SELECT md5((CASE WHEN coalesce(to_jsonb(t)->'service_action_config','null'::jsonb)='null'::jsonb
    THEN to_jsonb(t)-'service_action_config'-'service_action_owner_id' ELSE to_jsonb(t) END)::text) AS fingerprint,t.status_list_item_id INTO raw
   FROM campaign_status_list_automations t WHERE t.id=a->>'id';
  missing:=NOT FOUND;
  IF a->>'itemId'<>s.status_list_item_id AND raw.status_list_item_id IS DISTINCT FROM s.status_list_item_id THEN CONTINUE; END IF;
  df:=NULL;
  IF a->>'type'='set_contact_status' THEN
   SELECT md5(to_jsonb(d)::text) INTO df FROM campaign_dispositions d
    WHERE d.id=a->>'dispositionId' AND d.campaign_id=cc.campaign_id;
  END IF;
  INSERT INTO mission_callback_service_events(campaign_id,campaign_contact_id,event_id,action_id,
   owner,generation,actor_id,occurred_at,payload,state)
  VALUES(cc.campaign_id,cc.id,'confirmation:'||s.id,a->>'id',g.owner,g.generation,
   s.confirmed_by_user_id,s.confirmed_at,
   jsonb_build_object('action',a,'callCount',n,'manualDate',ctx->'manualDate','note',ctx->'note'),
   CASE WHEN missing OR raw.fingerprint IS DISTINCT FROM a->>'fingerprint'
    OR (a->>'type'='set_contact_status' AND df IS DISTINCT FROM a->>'dispositionFingerprint')
    THEN 'blocked' ELSE 'pending' END)
  ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION mission_callback_capture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM mission_callback_enqueue(NEW.id);
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER mission_callback_capture AFTER INSERT ON campaign_contact_status_list_state
 FOR EACH ROW EXECUTE FUNCTION mission_callback_capture();
`;
