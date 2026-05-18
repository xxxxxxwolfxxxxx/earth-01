-- 002_telegram_flex_rhythm.sql
-- Flexible day rhythm per agent + Telegram integration

-- 1. New columns on agents for per-agent rhythm
ALTER TABLE agents ADD COLUMN IF NOT EXISTS schedule_mode TEXT DEFAULT 'auto' CHECK (schedule_mode IN ('auto', 'manual'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS work_ticks INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS free_ticks INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS sleep_ticks INT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS cycle_start_tick BIGINT DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS forced_phase TEXT DEFAULT NULL CHECK (forced_phase IN ('free', 'work', 'sleep', NULL));

-- 2. New columns on profiles for Telegram
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT DEFAULT NULL;

-- 3. New table: agent_messages (chat history)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('user', 'agent')),
  content TEXT NOT NULL,
  tick BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_agent ON agent_messages(agent_id, created_at DESC);

-- 4. RLS for agent_messages
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own agent messages"
  ON agent_messages FOR SELECT
  USING (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can insert own agent messages"
  ON agent_messages FOR INSERT
  WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
  );

-- 5. Service role can do everything on agent_messages (for webhook edge function)
CREATE POLICY "Service role full access to agent_messages"
  ON agent_messages FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Enable realtime on agent_messages
ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;
