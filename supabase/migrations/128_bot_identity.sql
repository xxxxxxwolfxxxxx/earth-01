-- Bot-Identität: Avatar (Emoji) + Username aus Telegram
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bot_avatar   TEXT,
  ADD COLUMN IF NOT EXISTS bot_username TEXT;
