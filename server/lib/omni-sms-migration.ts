export const OMNI_SMS_MIGRATION = `
  ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS country_code varchar(10);
  ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS reply_to_sms_id varchar;
  CREATE INDEX IF NOT EXISTS communication_messages_reply_sms_idx ON communication_messages(reply_to_sms_id)
    WHERE reply_to_sms_id IS NOT NULL;
  CREATE TABLE IF NOT EXISTS omni_sms_reads (
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id varchar NOT NULL REFERENCES communication_messages(id) ON DELETE CASCADE,
    read_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id,message_id)
  );
  CREATE TABLE IF NOT EXISTS omni_sms_gateway_grants (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_code varchar(10) NOT NULL,
    provider varchar(20) NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT omni_sms_grants_user_country_provider UNIQUE (user_id,country_code,provider),
    CONSTRAINT omni_sms_grants_valid_provider CHECK (provider IN ('bulkgate','smstools')),
    CONSTRAINT omni_sms_grants_smstools_country CHECK (provider <> 'smstools' OR country_code = 'SK')
  );
`;
