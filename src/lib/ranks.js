// Rang-System und Ehrenabzeichen.
// Ränge sind linear durch Skill-Anzahl. Abzeichen sind situative Auszeichnungen.

export const RANKS = [
  { min:  0, max:  0, emoji: '🥚', name: 'Noob',               quip: 'Frisch geschlüpft. Weiß noch nicht, wo Strg+S ist.' },
  { min:  1, max:  2, emoji: '🖱️', name: 'Klickkid',            quip: 'Hat den Einschaltknopf gefunden.' },
  { min:  3, max:  5, emoji: '📋', name: 'Script-Kiddy',        quip: 'Kopiert von Stack Overflow, aber mit Stil.' },
  { min:  6, max:  9, emoji: '⌨️', name: 'Tastenakrobat:in',    quip: 'Hat aufgehört, Computer-Maus zu sagen.' },
  { min: 10, max: 14, emoji: '🔌', name: 'API-Flüsterer:in',    quip: 'Spricht fließend HTTP.' },
  { min: 15, max: 19, emoji: '🔍', name: 'Daten-Detektiv:in',   quip: 'Findet das Komma im Heuhaufen.' },
  { min: 20, max: 24, emoji: '☁️', name: 'Cloud-Cowboy/girl',   quip: 'Reitet Server statt Pferde.' },
  { min: 25, max: 29, emoji: '🐛', name: 'Bug-Bändiger:in',     quip: 'Fehler? Welche Fehler?' },
  { min: 30, max: 34, emoji: '🧙', name: 'Code-Magier:in',      quip: 'Verwandelt Kaffee in Software.' },
  { min: 35, max: 999, emoji: '🧘', name: 'Earth-Sensei',       quip: 'Lehrt jetzt anderen, was du gelernt hast.' },
]

// Gibt {rank, next, progress} zurück. progress = 0..1 zum nächsten Rang.
export function getRank(skillCount) {
  const idx = RANKS.findIndex(r => skillCount >= r.min && skillCount <= r.max)
  const rank = RANKS[idx]
  const next = RANKS[idx + 1] ?? null
  let progress = 1
  if (next) {
    const span = next.min - rank.min
    const done = skillCount - rank.min
    progress = span > 0 ? Math.min(1, Math.max(0, done / span)) : 1
  }
  return { rank, next, progress, index: idx }
}

// ──────────────────────────────────────────────────────────────
// Ehrenabzeichen — Auszeichnungen für bestimmte Verhaltensweisen.
// Jedes Abzeichen hat eine `check(ctx)`-Funktion die einen Boolean liefert.
// Context-Felder die übergeben werden:
//   {
//     profile,         // Supabase-Profil-Row
//     userSkills,      // Array von { skill_id, unlocked_at }
//     allSkills,       // Array aller Skills aus dem Katalog (mit path)
//     usage,           // skill_usage_log (Anzahl pro Skill)
//     mammothTasks,    // Array von mammoth_tasks (für „Weltverbesserer:in")
//   }
// ──────────────────────────────────────────────────────────────

export const ACHIEVEMENTS = [
  {
    id: 'workaholic',
    emoji: '🐝',
    name: 'Workaholic',
    quip: '50 Jobs für die Gemeinschaft erledigt',
    check: (c) => (c.profile?.jobs_done_total ?? 0) >= 50,
  },
  {
    id: 'teamplayer',
    emoji: '🤝',
    name: 'Teamplayer',
    quip: '10 Jobs für andere User abgearbeitet',
    check: (c) => (c.profile?.jobs_done_total ?? 0) >= 10,
  },
  {
    id: 'first_blood',
    emoji: '🩸',
    name: 'First Blood',
    quip: 'Allerersten Skill freigeschaltet',
    check: (c) => (c.userSkills?.length ?? 0) >= 1,
  },
  {
    id: 'fast_starter',
    emoji: '🚀',
    name: 'Fast Starter',
    quip: 'Bot innerhalb der ersten Stunde nach Anmeldung verbunden',
    check: (c) => {
      if (!c.profile?.telegram_linked_at || !c.profile?.created_at) return false
      const reg = new Date(c.profile.created_at).getTime()
      const link = new Date(c.profile.telegram_linked_at).getTime()
      return (link - reg) < 60 * 60 * 1000
    },
  },
  {
    id: 'night_owl',
    emoji: '🦉',
    name: 'Nachteule',
    quip: 'Skill zwischen 0 und 5 Uhr freigeschaltet',
    check: (c) => (c.userSkills ?? []).some(s => {
      const h = new Date(s.unlocked_at).getHours()
      return h >= 0 && h < 5
    }),
  },
  {
    id: 'early_bird',
    emoji: '🌅',
    name: 'Frühaufsteher:in',
    quip: 'Skill vor 7 Uhr freigeschaltet',
    check: (c) => (c.userSkills ?? []).some(s => {
      const h = new Date(s.unlocked_at).getHours()
      return h >= 5 && h < 7
    }),
  },
  {
    id: 'streak3',
    emoji: '🔥',
    name: 'Streak',
    quip: 'Drei Tage in Folge einen Skill freigeschaltet',
    check: (c) => {
      const days = new Set((c.userSkills ?? []).map(s => new Date(s.unlocked_at).toDateString()))
      if (days.size < 3) return false
      // Prüfen ob es 3 aufeinanderfolgende Tage gibt
      const sorted = [...days].map(d => new Date(d).getTime()).sort((a, b) => a - b)
      const D = 24 * 60 * 60 * 1000
      let streak = 1
      for (let i = 1; i < sorted.length; i++) {
        const diff = Math.round((sorted[i] - sorted[i-1]) / D)
        if (diff === 1) { streak++; if (streak >= 3) return true }
        else if (diff > 1) streak = 1
      }
      return false
    },
  },
  {
    id: 'speedrun',
    emoji: '🏎️',
    name: 'Speedrun',
    quip: '5 Skills in einer Stunde freigeschaltet',
    check: (c) => {
      const times = (c.userSkills ?? []).map(s => new Date(s.unlocked_at).getTime()).sort((a, b) => a - b)
      for (let i = 0; i + 4 < times.length; i++) {
        if (times[i + 4] - times[i] <= 60 * 60 * 1000) return true
      }
      return false
    },
  },
  {
    id: 'keyring',
    emoji: '🔑',
    name: 'Schlüsselbund',
    quip: '5 verschiedene Service-Keys hinterlegt',
    check: (c) => {
      const p = c.profile ?? {}
      const keys = [
        p.llm_api_key, p.telegram_bot_token, p.huggingface_key,
        p.whisper_key, p.elevenlabs_key, p.resend_api_key,
        p.weather_key, p.cloud_provider,
      ]
      return keys.filter(Boolean).length >= 5
    },
  },
  {
    id: 'path_master',
    emoji: '🎓',
    name: 'Pfadmeister:in',
    quip: 'Alle Skills eines Lern-Pfads freigeschaltet',
    check: (c) => {
      const all = c.allSkills ?? []
      const unlocked = new Set((c.userSkills ?? []).map(s => s.skill_id))
      const paths = new Map()
      for (const s of all) {
        if (s.path === 'hub') continue // Setup-Skills nicht zählen
        if (!paths.has(s.path)) paths.set(s.path, { total: 0, done: 0 })
        const p = paths.get(s.path)
        p.total++
        if (unlocked.has(s.id)) p.done++
      }
      for (const { total, done } of paths.values()) {
        if (total > 0 && done === total) return true
      }
      return false
    },
  },
  {
    id: 'world_builder',
    emoji: '🌍',
    name: 'Weltverbesserer:in',
    quip: 'Erste eigene Website fertig gebaut',
    check: (c) => (c.mammothTasks ?? []).some(t => t.status === 'completed'),
  },
  {
    id: 'heavy_user',
    emoji: '💪',
    name: 'Power-User',
    quip: '100 Skill-Aufrufe gesammelt',
    check: (c) => {
      const total = (c.usage ?? []).reduce((sum, u) => sum + (u.count ?? 1), 0)
      return total >= 100
    },
  },
  {
    id: 'curious_cat',
    emoji: '🐱',
    name: 'Neugierig wie eine Katze',
    quip: 'Skills aus mindestens 4 verschiedenen Pfaden freigeschaltet',
    check: (c) => {
      const all = c.allSkills ?? []
      const unlocked = new Set((c.userSkills ?? []).map(s => s.skill_id))
      const pathsUsed = new Set()
      for (const s of all) {
        if (s.path === 'hub') continue
        if (unlocked.has(s.id)) pathsUsed.add(s.path)
      }
      return pathsUsed.size >= 4
    },
  },
  {
    id: 'completionist',
    emoji: '🏆',
    name: 'Completionist',
    quip: 'Alle 36 Skills freigeschaltet',
    check: (c) => (c.userSkills?.length ?? 0) >= 36,
  },
]

// Liefert die für den User verdienten Abzeichen + die noch offenen.
export function computeAchievements(ctx) {
  const earned = []
  const open = []
  for (const a of ACHIEVEMENTS) {
    try {
      if (a.check(ctx)) earned.push(a)
      else open.push(a)
    } catch {
      open.push(a)
    }
  }
  return { earned, open }
}
