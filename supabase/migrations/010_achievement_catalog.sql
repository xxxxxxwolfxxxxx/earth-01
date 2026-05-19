-- 010_achievement_catalog.sql
-- 20 Achievements als Konstanten gespeichert. Jedes Achievement
-- referenziert ein tool_id; die Tool-Edge-Functions werden in Phase C
-- geschrieben.

INSERT INTO public.achievements (id, name, icon, tier, description, unlock_condition, tool_id, key_class, display_order) VALUES
-- Tier 1 — Anfang
('schriftgelehrte', 'Schriftgelehrte:r', '📚', 1, 'Erforsche die Tech "Schrift".', '{"type":"tech_researched","tech":"writing"}', 'web_search', 'builtin', 11),
('zeitmesser', 'Zeitmesser:in', '🕰️', 1, 'Baue dein erstes Gebäude.', '{"type":"tile_built","tile_type":"b","min":1}', 'reminder', 'builtin', 12),
('versorger', 'Versorger:in', '🌾', 1, 'Baue deine erste Farm.', '{"type":"tile_built","tile_type":"F","min":1}', 'shopping_list', 'builtin', 13),
('koch', 'Koch/Köchin', '🍳', 1, 'Iss 50 Mal.', '{"type":"action_count","action":"eat","min":50}', 'recipe_helper', 'extended', 14),
('erkunder', 'Erkunder:in', '🌍', 1, 'Besuche 30 verschiedene Tiles.', '{"type":"tiles_visited","min":30}', 'travel_info', 'builtin', 15),
('wassersucher', 'Wassersucher:in', '💧', 1, 'Trink 20 Mal.', '{"type":"action_count","action":"drink","min":20}', 'weather', 'builtin', 16),

-- Tier 2 — Aufstieg
('diplomat', 'Diplomat:in', '🤝', 2, 'Gründe deine erste Allianz.', '{"type":"alliance_founded","min":1}', 'multi_agent_chat', 'extended', 21),
('kuenstler', 'Künstler:in', '🎨', 2, 'Erforsche die Tech "Philosophie".', '{"type":"tech_researched","tech":"philosophy"}', 'image_generate', 'extended', 22),
('patriarch', 'Patriarch:in', '🧬', 2, 'Habe 3 lebende Nachfahren gleichzeitig.', '{"type":"descendants_alive","min":3}', 'family_memory', 'builtin', 23),
('heiler', 'Heiler:in', '⚕️', 2, 'Erforsche die Tech "Medizin".', '{"type":"tech_researched","tech":"medicine"}', 'symptom_tracker', 'builtin', 24),
('haendler', 'Händler:in', '💰', 2, '5 Handels-Aktionen abgeschlossen.', '{"type":"trades_completed","min":5}', 'price_compare', 'extended', 25),
('baumeister', 'Baumeister:in', '🏗️', 2, 'Erforsche die Tech "Maurerei".', '{"type":"tech_researched","tech":"masonry"}', 'project_manager', 'builtin', 26),

-- Tier 3 — Meister
('ingenieur', 'Ingenieur:in', '⚒️', 3, 'Erforsche die Tech "Ingenieurwesen".', '{"type":"tech_researched","tech":"engineering"}', 'math_eval', 'builtin', 31),
('beschuetzer', 'Beschützer:in', '🛡️', 3, '10 Kills als Wache.', '{"type":"kills","min":10}', 'security_check', 'extended', 32),
('geschichtsschreiber', 'Geschichtsschreiber:in', '📜', 3, 'Erreiche Generation 3.', '{"type":"generation_reached","min":3}', 'diary', 'builtin', 33),
('gesetzgeber', 'Gesetzgeber:in', '⚖️', 3, 'Erforsche die Tech "Demokratie".', '{"type":"tech_researched","tech":"democracy"}', 'decision_helper', 'extended', 34),
('polyglott', 'Polyglott', '🌐', 3, 'Sei in 5 verschiedenen Allianzen gewesen.', '{"type":"alliances_distinct","min":5}', 'translator', 'extended', 35),

-- Tier 4 — Meta
('dynastie', 'Dynastie', '👑', 4, 'Erreiche Generation 5.', '{"type":"generation_reached","min":5}', 'personality_style', 'builtin', 41),
('legende', 'Legende', '🏆', 4, 'Schalte 10+ andere Achievements frei.', '{"type":"achievement_count","min":10}', 'email_send', 'extended', 42),
('weiser', 'Weise:r', '🧠', 4, 'Erforsche alle 12 Techs.', '{"type":"all_techs_researched"}', 'autonomous_mode', 'builtin', 43)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  unlock_condition = EXCLUDED.unlock_condition,
  tool_id = EXCLUDED.tool_id,
  key_class = EXCLUDED.key_class,
  display_order = EXCLUDED.display_order;
