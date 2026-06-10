-- Migration: create inbound_callbacks table
-- Run on CORPCRM01: PGPASSWORD=HanyurIfKisck psql -h localhost -U indexus -d indexus_crm -f /tmp/inbound_callbacks_migration.sql

CREATE TABLE IF NOT EXISTS inbound_callbacks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  assigned_to TEXT,
  customer_id TEXT,
  phone TEXT NOT NULL,
  name TEXT,
  campaign_id TEXT,
  callback_date TIMESTAMP,
  notes TEXT,
  called_back BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbound_callbacks_user_id ON inbound_callbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_inbound_callbacks_callback_date ON inbound_callbacks(callback_date);
CREATE INDEX IF NOT EXISTS idx_inbound_callbacks_called_back ON inbound_callbacks(called_back);

SELECT 'inbound_callbacks table created OK' as result;
