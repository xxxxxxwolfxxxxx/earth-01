# Phase 4 — Job-Wirtschaft + Mammutaufgaben

**Status:** Brainstormed, awaiting plan
**Ersetzt:** Phase 3 Token-Spende-Mechanik (dormant, nie aktiviert)
**Datum:** 2026-05-21

---

## Ziel in einem Satz

Aus „User spendet passiv Resttokens" wird „User schickt Bot bewusst arbeiten,
verdient Job-Credits, spart auf eine eigene Mammutaufgabe (z.B. persönliche Website),
und 10% jedes Jobs fließen in einen sichtbaren Gemeinschafts-Pool, der globale
Lehr-Artikel finanziert".

## Kern-Idee

**Reziprozität statt Spende.** User trägt aktiv bei, kriegt etwas zurück. Eine Free-API
allein schafft kein Buch oder keine Website — eine Gruppe von 10 Bots in 2-3 Tagen schon.

## Mechanik (kompakt)

```
User schaltet "teamwork"-Skill frei                  → Skill-System
"/arbeiten" an Bot                                   → bot_at_work = true
Orchestrator weist Jobs zu (mit User-Limits)         → article_jobs.assigned_to
Pro fertigem Job:
  user.job_credits += 0.9
  community_pool.credits += 0.1                      → 10% Tax
"/heim" an Bot                                       → bot_at_work = false
"/projekt website Mein Portfolio" (50 Credits)       → mammoth_tasks-Eintrag
  → Pipeline mit ~15 Jobs erzeugt, priority=2
  → User-Credits sofort abgebucht
At-work-Bots priorisieren mammoth-Jobs               → orchestrator-Logik
Mammutaufgabe fertig → Result-ZIP-URL auf /bot       → Download-Link
Community-Pool finanziert globale Lehr-Artikel       → wie Phase 3 ursprünglich
```

## Designprinzipien

1. **Aktiv statt passiv:** User entscheidet wann Bot arbeitet (`/arbeiten`).
2. **Reziprozität:** Pro Beitrag konkrete Belohnung (Credits).
3. **Sichtbarkeit:** Tax-Pool ist transparent — User sieht was die Gemeinschaft daraus baut.
4. **Skill-basiert:** `teamwork` wird gelernt wie jeder andere Skill.
5. **MVP-Scope:** Erste Mammutaufgabe-Sorte = persönliche Website. Mehr Typen später.

## Mammutaufgabe: Persönliche Website (MVP)

**Was entsteht:**
- Single-Page-Website (HTML + CSS + minimal JS), als ZIP-Download
- Customizable: User-Name, User-Beschreibung, User-Foto-URL (optional), Farben, Branche/Persona
- Inhalte: Hero, Über-Mich, Skills/Services, Kontakt, Footer
- 2-3 generierte Hero-Bilder
- Mobile-responsive
- Selbstgehostet möglich (drop ZIP in Netlify/Vercel/eigener Server)

**Pipeline (~15 Jobs für eine Website):**
1. `mammoth_brief` (1 Call) — User-Input zu strukturiertem Brief
2. `mammoth_design_concept` (2 Calls) — Farbschema + Stil-Vorschlag (Modern/Minimal/Bold/Warm)
3. `mammoth_section_hero` (2 Calls) — Hero-Inhalt
4. `mammoth_section_about` (2 Calls) — Über-Mich-Sektion
5. `mammoth_section_services` (2 Calls) — Services/Skills-Sektion
6. `mammoth_section_contact` (1 Call) — Kontakt-Sektion mit Formular
7. `mammoth_image_hero` (1 Bild) — Hero-Bild
8. `mammoth_image_secondary` (2 Bilder) — Begleitbilder
9. `mammoth_html_assemble` (3 Calls) — HTML aus Inhalten + Design zusammenbauen
10. `mammoth_css_styling` (3 Calls) — CSS basierend auf Design-Konzept
11. `mammoth_review_html` (1 Call) — Code-Review, Mobile-Check, Accessibility
12. `mammoth_revise` (3 Calls, optional) — Falls Review-Issues
13. `mammoth_package` (1 Call) — Finales ZIP bauen (HTML, CSS, Bilder, README)

**Kosten:** 50 Credits (≈ 17 Tage Bot-Arbeit beim Tagessommittel 3 Jobs).

## Datenbank-Schema (Migration 123)

```sql
-- Profil-Erweiterungen
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bot_at_work BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bot_work_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS job_credits NUMERIC(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jobs_done_total INT NOT NULL DEFAULT 0;

-- Community-Pool (Singleton)
CREATE TABLE IF NOT EXISTS public.community_pool (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  credits_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_collected NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_funded_article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.community_pool (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.community_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read pool" ON public.community_pool FOR SELECT USING (true);

-- Mammutaufgaben
CREATE TABLE IF NOT EXISTS public.mammoth_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('website')),
  title TEXT NOT NULL,
  brief JSONB NOT NULL,                  -- User-Input strukturiert
  credits_cost INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed','failed','cancelled')),
  progress INT NOT NULL DEFAULT 0,       -- 0-100
  result_data JSONB,                     -- z.B. { html, css, image_urls }
  result_url TEXT,                       -- Download-URL (Storage)
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mammoth_tasks_user_idx ON public.mammoth_tasks(user_id, created_at DESC);
CREATE INDEX mammoth_tasks_status_idx ON public.mammoth_tasks(status);

ALTER TABLE public.mammoth_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own mammoth" ON public.mammoth_tasks
  FOR SELECT USING (auth.uid() = user_id);

-- article_jobs braucht neue Spalten für Mammut-Verknüpfung + Priorität
ALTER TABLE public.article_jobs
  ADD COLUMN IF NOT EXISTS mammoth_task_id UUID REFERENCES public.mammoth_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS article_jobs_priority_idx ON public.article_jobs(priority DESC, created_at ASC);

-- job_type CHECK erweitern um mammoth_*-Typen
ALTER TABLE public.article_jobs DROP CONSTRAINT IF EXISTS article_jobs_job_type_check;
ALTER TABLE public.article_jobs ADD CONSTRAINT article_jobs_job_type_check
  CHECK (job_type IN (
    'topic_propose','research','draft','illustrate','code_snippet','review','revise',
    'mammoth_brief','mammoth_design_concept','mammoth_section_hero','mammoth_section_about',
    'mammoth_section_services','mammoth_section_contact','mammoth_image_hero',
    'mammoth_image_secondary','mammoth_html_assemble','mammoth_css_styling',
    'mammoth_review_html','mammoth_revise','mammoth_package'
  ));
```

## Skill-Migration (124)

- DEAKTIVIERE `donate_tokens`-Skill (UPDATE auf hidden=true ODER DELETE).
- NEUER Skill `teamwork` im neuen Pfad `gemeinschaft`:
  - id: `teamwork`
  - path: `gemeinschaft`
  - icon: 🤝
  - type: action
  - pattern: `/arbeiten|/heim|/credits`
  - description: Bot arbeiten schicken, Credits verdienen, Mammutaufgaben starten
- NEUER Skill `mammoth_website` im selben Pfad:
  - id: `mammoth_website`
  - icon: 🌐
  - type: action
  - pattern: `/projekt website|/website neu`
  - requires: `teamwork` + min. 50 Credits

Profile-Spalten `donate_tokens`, `donate_threshold`, `donate_show_credit` werden nicht gedroppt
(legacy), aber UI auf `/data` zeigt sie nicht mehr.

## Edge Functions

### `swarm-orchestrator` (Umbau)

**Was sich ändert:**
- Activation-Gate: jetzt `count(profiles WHERE bot_at_work=true) >= 5` (statt 10 für donate_tokens)
- Job-Assignment: User-Eligibility = `bot_at_work=true` (nicht `donate_tokens=true`)
- Mammut-Priorität: Jobs mit `mammoth_task_id IS NOT NULL` werden zuerst zugewiesen (ORDER BY priority DESC, created_at ASC)
- Harvest-Window-Logik entfällt: User triggert selbst via `/arbeiten`
- Pipeline-Progression für mammoth_tasks: nach jedem Job die mammoth_tasks.progress aktualisieren

### `swarm-worker` (Erweiterung)

**Neu nach erfolgreichem Job:**
```ts
// 1. job_credits-Buchung
const credits = 1.0; // alle Jobs gleich gewertet im MVP
const userShare = 0.9;
const poolShare = 0.1;

await supabase.rpc('book_credits', {
  p_user_id: user.id,
  p_user_share: userShare,
  p_pool_share: poolShare,
});

// 2. Falls mammoth-Job: progress updaten
if (job.mammoth_task_id) {
  await updateMammothProgress(supabase, job.mammoth_task_id);
}
```

Plus RPC `book_credits(p_user_id, p_user_share, p_pool_share)`:
- UPDATE profiles SET job_credits += p_user_share, jobs_done_total += 1
- UPDATE community_pool SET credits_balance += p_pool_share, total_collected += p_pool_share

### `start-mammoth` (NEU)

POST mit User-Auth, body: `{ task_type: 'website', brief: { ... } }`.

1. Auth + Brief-Validierung
2. Check `profile.job_credits >= 50`
3. Insert `mammoth_tasks`-Eintrag
4. UPDATE `profile.job_credits -= 50`
5. Erzeuge `~15 article_jobs` mit `mammoth_task_id` + `priority=2` (waiting-Status)
6. Optional: Article-Stub anlegen für Job-Article-Linkage
7. Return `{ task_id, jobs_created }`

### `mammoth-status` (NEU oder via DB-Polling)

Frontend pollt `mammoth_tasks` direkt. Realtime ist Bonus für Phase 4.1.

## Telegram-Webhook-Erweiterung

Neue Handler:

| Pattern | Aktion |
|---|---|
| `/arbeiten`, `/bot arbeiten` | `bot_at_work=true`, Bestätigung „Bot ist los." |
| `/heim`, `/bot heim` | `bot_at_work=false`, Bestätigung mit Credits-Zuwachs heute |
| `/credits` | Antwort: aktuelle Credits + Lifetime-Jobs |
| `/projekt website <Titel>` | Startet Brief-Dialog (mehrstufig) ODER ruft `start-mammoth` mit Defaults |

Für Brief-Dialog: vereinfachter MVP — Bot antwortet mit „Geh auf /bot und start dein Projekt dort, dann hast du das Formular vor dir." Telegram-Dialog für strukturiertes Brief-Eintippen ist Phase 4.1.

## Frontend

### `/bot`-Seite (Erweiterung)

Bestehende Sektionen bleiben. Neu:

**Bot-Status-Karte (oben):**
- Großer Toggle „Bot arbeitet" (mit Animation wenn aktiv)
- „Bot ist los seit X Min" / „Bot zu Hause"
- Buttons: 🟢 Arbeiten / 🏠 Heim

**Credits-Anzeige:**
- Aktueller Stand groß und prominent
- Letzte 5 Credits-Bewegungen (mini-Log)
- „Lifetime: X Jobs erledigt"

**Mammutaufgaben-Sektion:**
- Liste laufender + abgeschlossener mammoth_tasks
- Progress-Bar pro Task
- „Neues Projekt starten" Button (nur enabled wenn >=50 Credits)
- Form: Typ-Auswahl (im MVP nur „Website"), Brief-Felder (Name, Slogan, Sektionen, Stil)
- Bei Abschluss: Download-Link für ZIP

### `/erde-lernt`-Seite (Erweiterung)

**Community-Pool-Box (prominent oben):**
- „Wir haben zusammen X Jobs erledigt"
- „Y Credits im Gemeinschafts-Pool"
- „Davon flossen Z in: <Liste der pool-finanzierten Artikel>"
- Live-Counter (Polling all 60s)

**Filter:** „Alle Artikel" / „Pool-finanziert" / „Mammut-Beiprodukte" (falls article-jobs nebenbei was Pool-würdiges erzeugen)

## ZIP-Bau für Website-Mammutaufgabe

`mammoth_package`-Job:
- Sammelt HTML, CSS, image-URLs aus vorherigen Jobs
- Im Worker: bauen ZIP via Deno's standard library oder lib like `@zip-js/zip-js`
- Upload ins Supabase Storage Bucket (`mammoth-results`, public-read)
- Setze `mammoth_tasks.result_url` auf signed URL (oder public URL)

Storage-Bucket Setup-SQL (in Migration 123):
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('mammoth-results', 'mammoth-results', true)
ON CONFLICT DO NOTHING;
```

## Anti-Missbrauch

**Credits-Inflation:**
- User-Tageslimit bleibt: max 3 Jobs/Tag = max 2.7 Credits/Tag
- Bei Hochbetrieb: Plattform-Tages-Cap 1000 Jobs (wie Phase 3)
- Mammut-Cost (50 Credits) erfordert ~17 Tage Bot-Arbeit — kein Quick-Cash

**Spam-Mammutaufgaben:**
- Max 1 aktive Mammut-Task pro User (status='pending'|'in_progress')
- Brief-Felder werden serverseitig auf gemeinsamen Promo-Filter geprüft (gleiche qualityScore-Logik)

**Faulheit (User opted, Bot tut nichts):**
- Wenn `bot_at_work=true` aber `last_job_at < now() - 24h`: Bot wird automatisch auf `bot_at_work=false` zurückgesetzt mit Hinweis „Bot war 24h ohne Job, ist nach Hause"

## Migrationspfad von Phase 3

- Phase 3 ist dormant (never activated, threshold = 10, war noch keine 10 spendende User)
- Phase 4 ersetzt einfach: neuer Skill, neue Orchestrator-Logik
- Profile-Spalten der alten Spende werden nicht gedroppt (legacy, aber ungenutzt)
- topic_pool, articles, article_jobs, article_revisions BLEIBEN — werden von Pool-finanzierten Lehr-Artikeln weiter genutzt
- swarm-orchestrator wird umgebaut, NICHT neu

## Was bewusst NICHT in Phase 4 ist

- Weitere Mammutaufgaben-Typen (Buch, App, Tutorial-Serie) — Phase 4.1
- Credit-Transfer zwischen Usern — Phase 4.2
- Mehrere parallele Mammutaufgaben pro User — Phase 4.2
- Progressive Tax (mehr Credits = mehr %) — Phase 4.1
- Brief-Dialog via Telegram — Phase 4.1 (im MVP nur via /bot-Formular)

---

**Nächster Schritt:** Implementierungsplan via `writing-plans`-Skill.
