/** Private B1-only schema. Never imported by the production HTTP entry point. */
export const B1_SCHEMA = `
CREATE TABLE users(id varchar PRIMARY KEY,username text UNIQUE NOT NULL,full_name text NOT NULL,
  email text NOT NULL,role text NOT NULL,is_active boolean NOT NULL,assigned_countries text[] NOT NULL);
CREATE TABLE tasks(id varchar PRIMARY KEY,title text NOT NULL,description text,due_date timestamp,
  priority text NOT NULL DEFAULT 'medium',status text NOT NULL DEFAULT 'pending',
  assigned_user_id varchar NOT NULL,created_by_user_id varchar NOT NULL,customer_id varchar,
  related_entity_type text,related_entity_id varchar,country text,resolution text,resolved_by_user_id varchar,
  resolved_at timestamp,work_started_at timestamp,work_stopped_at timestamp,request_recipients jsonb,
  tags text[] NOT NULL DEFAULT '{}',attachments jsonb NOT NULL DEFAULT '[]',bo_state text DEFAULT 'received',
  created_at timestamp NOT NULL DEFAULT now(),updated_at timestamp NOT NULL DEFAULT now());
CREATE TABLE task_group_members(group_id varchar,user_id varchar);
CREATE TABLE task_checklist_items(id varchar PRIMARY KEY DEFAULT gen_random_uuid(),task_id varchar NOT NULL,
  position integer NOT NULL,label text NOT NULL,required boolean NOT NULL DEFAULT false,
  done_at timestamp,done_by_user_id varchar,note text);
CREATE TABLE task_ai_checklist_generations(task_id varchar PRIMARY KEY,status text DEFAULT 'idle',
  error_code text,attempt_count integer DEFAULT 0,attempt_token varchar,fingerprint text,
  generated_item_count integer DEFAULT 0,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
CREATE TABLE b1_stage(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  stage text NOT NULL CHECK(stage IN ('checklist','resolution','summary')),reviewed_at timestamptz);
INSERT INTO b1_stage VALUES(true,'checklist',NULL);
CREATE TABLE b1_evidence(job_id uuid NOT NULL,attempt integer NOT NULL,raw_content text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(job_id,attempt));
INSERT INTO users VALUES('b1-operator','b1-operator','Syntetický operátor B1','b1@example.test','admin',true,ARRAY['SK']);
`;
