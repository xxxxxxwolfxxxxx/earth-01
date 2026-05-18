import { useState } from 'react'
import { BookOpen, ExternalLink, ChevronDown, ChevronRight, Dna, Brain, Globe, Cpu, Users, Sparkles, History, FlaskConical, Lightbulb, Rocket, HardDrive, MessageSquare, Shield, Baby, Sword, Hammer } from 'lucide-react'

/* ───────── SVG Diagrams ───────── */

function AgentDiagram() {
  return (
    <svg viewBox="0 0 600 280" className="w-full max-w-xl mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="30" width="160" height="220" rx="16" fill="#1a1a2e" stroke="#6366f1" strokeWidth="2" />
      <text x="100" y="22" textAnchor="middle" fill="#a5b4fc" fontSize="13" fontWeight="bold">Dein Agent</text>
      <circle cx="100" cy="80" r="24" fill="#6366f1" opacity="0.3" />
      <circle cx="100" cy="80" r="18" fill="#6366f1" />
      <text x="100" y="85" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">KI</text>
      <text x="100" y="120" textAnchor="middle" fill="#94a3b8" fontSize="10">Energie: 75/100</text>
      <text x="100" y="136" textAnchor="middle" fill="#94a3b8" fontSize="10">Reputation: 0.8</text>
      <text x="100" y="152" textAnchor="middle" fill="#94a3b8" fontSize="10">Alter: 120 Ticks</text>
      <rect x="40" y="170" width="120" height="24" rx="6" fill="#22c55e" opacity="0.15" stroke="#22c55e" strokeWidth="1" />
      <text x="100" y="186" textAnchor="middle" fill="#22c55e" fontSize="9">Kooperativ | Neugierig</text>
      <rect x="40" y="200" width="120" height="24" rx="6" fill="#f97316" opacity="0.15" stroke="#f97316" strokeWidth="1" />
      <text x="100" y="216" textAnchor="middle" fill="#f97316" fontSize="9">Risikofreudig</text>
      {/* Arrow to world */}
      <path d="M180 130 L240 130" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrowhead)" />
      <text x="210" y="122" textAnchor="middle" fill="#94a3b8" fontSize="9">handelt in</text>
      {/* World */}
      <rect x="240" y="30" width="160" height="220" rx="16" fill="#1a1a2e" stroke="#22c55e" strokeWidth="2" />
      <text x="320" y="22" textAnchor="middle" fill="#86efac" fontSize="13" fontWeight="bold">Die Welt</text>
      {/* Mini grid */}
      {[0,1,2,3,4].map(row =>
        [0,1,2,3,4].map(col => {
          const colors = [
            ['#0f0f1e','#22c55e','#0f0f1e','#3b82f6','#0f0f1e'],
            ['#0f0f1e','#0f0f1e','#22c55e','#0f0f1e','#ef4444'],
            ['#0f0f1e','#eab308','#0f0f1e','#0f0f1e','#0f0f1e'],
            ['#22c55e','#0f0f1e','#a855f7','#0f0f1e','#22c55e'],
            ['#0f0f1e','#0f0f1e','#0f0f1e','#22c55e','#0f0f1e'],
          ]
          return <rect key={`${row}-${col}`} x={268 + col * 22} y={50 + row * 22} width="18" height="18" rx="3" fill={colors[row][col]} stroke="#ffffff10" strokeWidth="1" />
        })
      )}
      <circle cx="312" cy="94" r="7" fill="#fbbf24" />
      <text x="320" y="180" textAnchor="middle" fill="#94a3b8" fontSize="10">Nahrung | Wasser</text>
      <text x="320" y="196" textAnchor="middle" fill="#94a3b8" fontSize="10">Gefahren | Gebäude</text>
      <text x="320" y="212" textAnchor="middle" fill="#94a3b8" fontSize="10">Andere Agenten</text>
      <text x="320" y="228" textAnchor="middle" fill="#94a3b8" fontSize="10">Jahreszeiten</text>
      {/* Arrow to LLM */}
      <path d="M400 130 L450 130" stroke="#f97316" strokeWidth="2" markerEnd="url(#arrowhead2)" />
      <text x="425" y="122" textAnchor="middle" fill="#94a3b8" fontSize="9">fragt</text>
      {/* LLM */}
      <rect x="450" y="60" width="130" height="140" rx="16" fill="#1a1a2e" stroke="#f97316" strokeWidth="2" />
      <text x="515" y="52" textAnchor="middle" fill="#fdba74" fontSize="13" fontWeight="bold">LLM (Gehirn)</text>
      <rect x="470" y="80" width="90" height="16" rx="4" fill="#f97316" opacity="0.2" />
      <rect x="470" y="80" width="60" height="16" rx="4" fill="#f97316" opacity="0.4" />
      <text x="515" y="92" textAnchor="middle" fill="#fdba74" fontSize="8">Denkt nach...</text>
      <text x="515" y="120" textAnchor="middle" fill="#94a3b8" fontSize="10">"Ich sollte</text>
      <text x="515" y="134" textAnchor="middle" fill="#94a3b8" fontSize="10">Nahrung suchen"</text>
      <rect x="470" y="150" width="90" height="28" rx="8" fill="#22c55e" opacity="0.15" stroke="#22c55e" strokeWidth="1" />
      <text x="515" y="168" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">→ move north</text>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#6366f1" />
        </marker>
        <marker id="arrowhead2" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" fill="#f97316" />
        </marker>
      </defs>
    </svg>
  )
}

function TimelineComparison() {
  const stages = [
    {
      human: 'Erste Zellen',
      humanTime: 'vor 3,5 Mrd. Jahren',
      agent: 'Agent wird erstellt',
      agentTime: 'Tick 0',
      color: '#22c55e',
    },
    {
      human: 'Mehrzellige Lebewesen',
      humanTime: 'vor 600 Mio. Jahren',
      agent: 'Agenten finden Nahrung',
      agentTime: 'Tick 1-80',
      color: '#3b82f6',
    },
    {
      human: 'Erste Tiere an Land',
      humanTime: 'vor 400 Mio. Jahren',
      agent: 'Agenten erkunden die Welt',
      agentTime: 'Tick 80-240',
      color: '#8b5cf6',
    },
    {
      human: 'Erste Werkzeuge',
      humanTime: 'vor 2,5 Mio. Jahren',
      agent: 'Agenten bauen Gebäude',
      agentTime: 'ab Tag 2',
      color: '#f97316',
    },
    {
      human: 'Sprache entsteht',
      humanTime: 'vor 100.000 Jahren',
      agent: 'Agenten kommunizieren',
      agentTime: 'ab Tag 1 (Freizeit)',
      color: '#ec4899',
    },
    {
      human: 'Erste Städte & Gesetze',
      humanTime: 'vor 5.000 Jahren',
      agent: 'Reputation & Verhaftungen',
      agentTime: 'ab Tag 2',
      color: '#eab308',
    },
    {
      human: 'Landwirtschaft',
      humanTime: 'vor 10.000 Jahren',
      agent: 'Farmen bauen',
      agentTime: 'ab Tag 3',
      color: '#22c55e',
    },
    {
      human: 'Kinder & Vererbung',
      humanTime: 'seit Anbeginn',
      agent: 'Reproduktion mit Mutation',
      agentTime: 'ab Tick 20',
      color: '#f43f5e',
    },
  ]

  return (
    <div className="relative">
      {/* Center line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-px" />
      <div className="space-y-4">
        {stages.map((s, i) => (
          <div key={i} className="relative flex items-center gap-4">
            {/* Human side */}
            <div className="flex-1 text-right pr-4">
              <div className="text-sm text-white font-medium">{s.human}</div>
              <div className="text-xs text-gray-500">{s.humanTime}</div>
            </div>
            {/* Center dot */}
            <div className="relative z-10 w-4 h-4 rounded-full shrink-0 border-2" style={{ borderColor: s.color, backgroundColor: `${s.color}33` }} />
            {/* Agent side */}
            <div className="flex-1 pl-4">
              <div className="text-sm font-medium" style={{ color: s.color }}>{s.agent}</div>
              <div className="text-xs text-gray-500">{s.agentTime}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4 text-xs text-gray-500 px-4">
        <span>Menschheit</span>
        <span>Earth 0.1 Agenten</span>
      </div>
    </div>
  )
}

function LLMExplainer() {
  return (
    <svg viewBox="0 0 520 200" className="w-full max-w-lg mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Input */}
      <rect x="10" y="60" width="120" height="80" rx="12" fill="#1a1a2e" stroke="#3b82f6" strokeWidth="2" />
      <text x="70" y="50" textAnchor="middle" fill="#93c5fd" fontSize="11" fontWeight="bold">Eingabe</text>
      <text x="70" y="90" textAnchor="middle" fill="#94a3b8" fontSize="9">"Ich habe Hunger</text>
      <text x="70" y="104" textAnchor="middle" fill="#94a3b8" fontSize="9">und sehe Nahrung</text>
      <text x="70" y="118" textAnchor="middle" fill="#94a3b8" fontSize="9">im Norden"</text>
      {/* Arrow */}
      <path d="M130 100 L180 100" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arr1)" />
      {/* Brain box */}
      <rect x="180" y="30" width="160" height="140" rx="16" fill="#1a1a2e" stroke="#a855f7" strokeWidth="2" />
      <text x="260" y="22" textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="bold">LLM (Sprachmodell)</text>
      {/* Neurons */}
      {[[220,70],[260,60],[300,70],[230,100],[260,100],[290,100],[240,130],[280,130]].map(([cx,cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="8" fill="#a855f7" opacity={0.2 + (i % 3) * 0.15} />
      ))}
      {[[220,70,260,60],[260,60,300,70],[230,100,260,100],[260,100,290,100],[260,60,260,100],[230,100,240,130],[290,100,280,130]].map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a855f7" strokeWidth="1" opacity="0.3" />
      ))}
      <text x="260" y="160" textAnchor="middle" fill="#94a3b8" fontSize="8">Milliarden Verbindungen</text>
      {/* Arrow */}
      <path d="M340 100 L390 100" stroke="#a855f7" strokeWidth="2" markerEnd="url(#arr2)" />
      {/* Output */}
      <rect x="390" y="60" width="120" height="80" rx="12" fill="#1a1a2e" stroke="#22c55e" strokeWidth="2" />
      <text x="450" y="50" textAnchor="middle" fill="#86efac" fontSize="11" fontWeight="bold">Ausgabe</text>
      <rect x="405" y="82" width="90" height="28" rx="8" fill="#22c55e" opacity="0.15" />
      <text x="450" y="100" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">move north</text>
      <text x="450" y="126" textAnchor="middle" fill="#94a3b8" fontSize="8">= "Geh nach Norden"</text>
      <defs>
        <marker id="arr1" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#3b82f6" /></marker>
        <marker id="arr2" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#a855f7" /></marker>
      </defs>
    </svg>
  )
}

function ModelFormatsExplainer() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
      {[
        { name: 'GGUF', desc: 'Universell, wie MP3 für Musik. Funktioniert auf fast jedem Computer.', color: '#3b82f6', tool: 'LM Studio, Ollama' },
        { name: 'MLX', desc: 'Speziell für Apple-Chips (M1-M4). Besonders schnell auf Macs.', color: '#f97316', tool: 'LM Studio (Mac)' },
        { name: 'Cloud-API', desc: 'Modell läuft im Internet. Kein Download nötig, braucht API-Key.', color: '#a855f7', tool: 'OpenAI, Google, etc.' },
      ].map(f => (
        <div key={f.name} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="text-lg font-bold font-mono mb-1" style={{ color: f.color }}>{f.name}</div>
          <p className="text-xs text-gray-400 mb-2">{f.desc}</p>
          <div className="text-xs text-gray-500">Tools: {f.tool}</div>
        </div>
      ))}
    </div>
  )
}

/* ───────── Beginner Glossary Terms ───────── */

const glossaryTerms = [
  {
    term: 'KI / AI',
    simple: 'Künstliche Intelligenz — ein Computerprogramm, das Aufgaben erledigt, die normalerweise menschliches Denken erfordern.',
    analogy: 'Wie ein Taschenrechner, aber statt Mathe kann es Sprache verstehen, Bilder erkennen oder Entscheidungen treffen.',
    icon: Brain,
  },
  {
    term: 'Agent',
    simple: 'Ein digitales Wesen in unserer Welt. Jeder Agent hat einen Namen, eine Position, Energie und eine Persönlichkeit.',
    analogy: 'Stell dir eine Figur in einem Videospiel vor — aber statt dass du sie steuerst, entscheidet sie selbst, was sie tut.',
    icon: Users,
  },
  {
    term: 'LLM',
    simple: 'Large Language Model — ein riesiges Sprachmodell. Es hat Milliarden von Texten gelesen und kann deshalb Sprache verstehen und Antworten geben.',
    analogy: 'Wie ein Mensch, der jedes Buch der Welt gelesen hat und jetzt auf Fragen antworten kann. Er "versteht" nicht wirklich, aber er gibt erstaunlich gute Antworten.',
    icon: Cpu,
  },
  {
    term: 'GGUF & MLX',
    simple: 'Dateiformate für KI-Modelle. Wie .mp3 für Musik oder .jpg für Bilder — aber für KI-Gehirne.',
    analogy: 'GGUF funktioniert auf fast jedem Computer. MLX ist speziell für Apple-Macs optimiert — wie ein Film, der auf 4K-TV besser aussieht.',
    icon: HardDrive,
  },
  {
    term: 'Tick',
    simple: 'Ein Zeitschritt in der Simulation. Alle 6 Sekunden passiert ein Tick. 240 Ticks = 1 Tag in der Agenten-Welt.',
    analogy: 'Wie der Sekundenzeiger einer Uhr. Bei jedem Tick entscheiden alle Agenten, was sie als Nächstes tun.',
    icon: History,
  },
  {
    term: 'Simulation',
    simple: 'Eine vereinfachte Nachbildung der echten Welt im Computer. Agenten leben, essen, bauen und sterben — wie in der Realität, nur schneller.',
    analogy: 'Wie ein Aquarium, in dem du Fische beobachtest — aber die Fische sind digital und die Zeit läuft 1000x schneller.',
    icon: Globe,
  },
  {
    term: 'Prompt',
    simple: 'Eine Anweisung an das LLM. Wir beschreiben dem KI-Gehirn die Situation, und es antwortet mit einer Entscheidung.',
    analogy: 'Wie wenn du jemandem sagst: "Du stehst in einem Wald, bist hungrig und siehst Beeren im Norden. Was tust du?"',
    icon: MessageSquare,
  },
  {
    term: 'Reputation',
    simple: 'Ein Wert von -1 bis +1, der zeigt, wie vertrauenswürdig ein Agent ist. Wer teilt, gewinnt Reputation. Wer stiehlt, verliert sie.',
    analogy: 'Wie dein Ruf im echten Leben. Wenn du immer hilfst, vertrauen dir die Leute. Wenn du betrügst, meiden sie dich.',
    icon: Shield,
  },
  {
    term: 'Generation',
    simple: 'Kinder von Agenten sind die nächste Generation. Sie erben Eigenschaften ihrer Eltern, aber mit kleinen zufälligen Änderungen.',
    analogy: 'Wie bei echten Familien: Du hast Eigenschaften deiner Eltern, bist aber trotzdem einzigartig.',
    icon: Baby,
  },
  {
    term: 'Emergenz',
    simple: 'Wenn viele einfache Teile zusammenwirken und etwas Komplexes entsteht, das niemand geplant hat.',
    analogy: 'Jede einzelne Ameise ist dumm. Aber zusammen bauen Ameisen Städte mit Klimaanlage und Müllabfuhr. Das ist Emergenz.',
    icon: Sparkles,
  },
]

/* ───────── Deep-Dive Sections (existing, improved) ───────── */

const deepSections = [
  {
    id: 'gameoflife',
    icon: History,
    title: "Conway's Game of Life — Wo alles begann",
    content: `
Stell dir ein Schachbrett vor, unendlich groß. Jedes Feld ist entweder "lebendig" oder "tot". Jede Runde passiert Folgendes:

**Die drei Regeln:**
1. Ein lebendiges Feld mit weniger als 2 Nachbarn stirbt (zu einsam)
2. Ein lebendiges Feld mit 2 oder 3 Nachbarn bleibt am Leben
3. Ein totes Feld mit genau 3 Nachbarn wird lebendig (Geburt!)

Das klingt simpel — aber was passiert, ist verblüffend: Es entstehen Muster, die sich bewegen ("Gleiter"), die pulsieren, und sogar Muster, die *andere Muster erschaffen*.

**Was hat das mit Earth 0.1 zu tun?**

Conway hat bewiesen: Man braucht keine komplizierten Regeln, um kompliziertes Verhalten zu erzeugen. Wir nehmen diese Idee und gehen weiter: Statt einfacher Zellen auf einem Brett haben wir KI-Agenten mit echten Entscheidungen, Erinnerungen und Persönlichkeiten.
    `,
    links: [
      { label: "Conway's Game of Life (Wikipedia)", url: 'https://de.wikipedia.org/wiki/Conways_Spiel_des_Lebens' },
      { label: 'Game of Life ausprobieren (interaktiv)', url: 'https://playgameoflife.com/' },
      { label: 'Emergenz einfach erklärt', url: 'https://de.wikipedia.org/wiki/Emergenz' },
    ],
  },
  {
    id: 'alife',
    icon: Dna,
    title: 'Digitales Leben — Frühere Experimente',
    content: `
Earth 0.1 ist nicht das erste Experiment mit digitalem Leben. Hier sind die wichtigsten Vorläufer:

**Tierra (1990)** — Programme, die sich selbst kopierten und um Computer-Ressourcen kämpften. Es entstanden digitale "Parasiten", die den Code anderer ausnutzten!

**Avida (1993)** — Eine Weiterentwicklung, die bis heute in der Forschung eingesetzt wird. Wissenschaftler konnten damit echte Vorhersagen der Evolutionstheorie bestätigen.

**Lenia (2018)** — Wunderschöne digitale "Kreaturen", die sich wie echte Mikroorganismen bewegen — obwohl sie nur aus Mathematik bestehen.

**Was macht Earth 0.1 anders?**

Alle bisherigen Projekte nutzen nur blinde Mutation — zufällige Änderungen, und die Besten überleben. Unsere Agenten können dagegen *denken*: Sie nutzen ein LLM (Sprachmodell), um Situationen zu analysieren und kluge Entscheidungen zu treffen. Das ist so, als ob die Ameisen plötzlich Bücher lesen könnten.
    `,
    links: [
      { label: 'Künstliches Leben', url: 'https://de.wikipedia.org/wiki/K%C3%BCnstliches_Leben' },
      { label: 'Lenia (Video)', url: 'https://en.wikipedia.org/wiki/Lenia' },
      { label: 'Avida', url: 'https://en.wikipedia.org/wiki/Avida' },
    ],
  },
  {
    id: 'evolution',
    icon: Dna,
    title: 'Evolution — Wie sich die Agenten weiterentwickeln',
    content: `
In der Natur funktioniert Evolution nach einem einfachen Prinzip:

1. **Alle sind unterschiedlich** — Kein Lebewesen ist exakt wie ein anderes
2. **Kinder erben Eigenschaften** — Du hast die Augenfarbe deiner Eltern
3. **Die Besten überleben** — Wer gut angepasst ist, bekommt mehr Kinder

**Wie funktioniert das in Earth 0.1?**

Unsere Agenten haben 5 Persönlichkeitswerte (wie "Neugier" oder "Kooperationsbereitschaft"). Wenn zwei Agenten ein Kind bekommen:
- Das Kind erbt einen Mix der Werte beider Eltern
- Dazu kommt eine kleine zufällige Änderung (Mutation)
- Wenn diese Eigenschaft hilft zu überleben, hat das Kind selbst später Kinder
- Wenn nicht, stirbt es — und die Eigenschaft verschwindet

**In der Natur brauchte das Milliarden Jahre. Hier können wir es in Tagen beobachten.**

**Zwei Arten von Evolution laufen gleichzeitig:**
- *Biologische:* Automatisch durch Überleben und Fortpflanzung
- *Kulturelle:* Du als Spieler beobachtest, was funktioniert, und designst bessere Agenten
    `,
    links: [
      { label: 'Evolution einfach erklärt', url: 'https://de.wikipedia.org/wiki/Evolution' },
      { label: 'Natürliche Selektion', url: 'https://de.wikipedia.org/wiki/Nat%C3%BCrliche_Selektion' },
      { label: 'Genetik für Einsteiger', url: 'https://de.wikipedia.org/wiki/Genetik' },
    ],
  },
  {
    id: 'llm-deep',
    icon: Cpu,
    title: 'LLMs — Das Gehirn der Agenten',
    content: `
Ein Large Language Model (LLM) ist eine KI, die auf riesigen Mengen Text trainiert wurde. Stell dir vor, jemand hat jedes Buch, jede Webseite und jeden Artikel der Welt gelesen — und kann jetzt Fragen beantworten.

**Wie nutzen unsere Agenten ein LLM?**

Wenn ein Agent eine Entscheidung treffen muss, beschreiben wir seine Situation in normalem Text:

*"Du bist Luna, ein Agent. Deine Energie ist bei 30/100. Im Norden siehst du Nahrung. Im Osten ist ein feindlicher Agent. Was tust du?"*

Das LLM antwortet zum Beispiel: *"Ich gehe nach Norden zur Nahrung."*

**Wo läuft das LLM?**

Du hast zwei Möglichkeiten:
- **Auf deinem Computer:** Mit LM Studio oder Ollama — kostenlos, privat, keine Internetverbindung nötig
- **In der Cloud:** Über APIs wie OpenAI oder Google Gemini — stärker, aber braucht Internet und teils Geld

**Was sind GGUF und MLX?**

Das sind Dateiformate für KI-Modelle — wie .mp3 für Musik:
    `,
    links: [
      { label: 'Was ist ein LLM? (einfach)', url: 'https://de.wikipedia.org/wiki/Large_Language_Model' },
      { label: 'LM Studio (kostenlos)', url: 'https://lmstudio.ai/' },
      { label: 'Ollama (kostenlos)', url: 'https://ollama.ai/' },
      { label: 'OpenAI API', url: 'https://platform.openai.com/' },
      { label: 'Google Gemini', url: 'https://ai.google.dev/' },
    ],
    extra: ModelFormatsExplainer,
  },
  {
    id: 'social',
    icon: Users,
    title: 'Gesellschaft — Wie Agenten zusammenleben',
    content: `
In der Natur sind die erfolgreichsten Arten nicht die stärksten — sondern die, die am besten zusammenarbeiten. Menschen, Ameisen, Bienen: Alle haben komplexe Gesellschaften entwickelt.

**Das Grundproblem: Kooperation vs. Eigennutz**

Stell dir vor, du und ein Freund findet Nahrung. Ihr könnt:
- **Teilen** — Beide überleben, aber keiner ist satt
- **Für dich behalten** — Du bist satt, dein Freund hungert

Kurzfristig lohnt sich Eigennutz. Aber langfristig? Wenn alle nur an sich denken, hilft dir niemand, wenn DU Hilfe brauchst.

**Wie löst Earth 0.1 das?**

- **Reputation:** Wer teilt, bekommt gute Reputation. Wer stiehlt, schlechte.
- **Andere sehen deine Reputation** und entscheiden: Helfe ich dir oder nicht?
- **Agenten mit schlechter Reputation** können verhaftet werden (Gefängnis!)
- **Zur Fortpflanzung braucht man einen Partner** — und wer will schon mit einem Dieb?

Das erzwingt eine Balance: Etwas Eigennutz ist okay, aber zu viel wird bestraft.
    `,
    links: [
      { label: 'Spieltheorie einfach erklärt', url: 'https://de.wikipedia.org/wiki/Spieltheorie' },
      { label: 'Gefangenendilemma', url: 'https://de.wikipedia.org/wiki/Gefangenendilemma' },
      { label: 'Kooperation in der Natur', url: 'https://de.wikipedia.org/wiki/Kooperation_(Biologie)' },
    ],
  },
  {
    id: 'building',
    icon: Hammer,
    title: 'Bauen — Wie Agenten die Welt verändern',
    content: `
In der Menschheitsgeschichte war der Moment, in dem wir anfingen zu bauen, ein Wendepunkt. Hütten, dann Häuser, dann Städte — jede Generation baute auf dem auf, was die vorherige hinterlassen hatte.

**In Earth 0.1 können Agenten:**

- **Unterschlupf bauen** — Schützt vor dem harten Winter (halbiert den Energieverbrauch!)
- **Farmen anlegen** — Erzeugen Nahrung in der Umgebung
- **Straßen bauen** — Ermöglichen schnellere Bewegung
- **Gebäude errichten** — Allgemeine Strukturen

**Warum ist das wichtig?**

Bauen kostet Energie. Ein Agent, der eine Farm baut, hat kurzfristig weniger Energie — aber langfristig profitieren alle Agenten in der Nähe von der Nahrung. Das fördert Kooperation: Alleine eine Farm zu bauen ist riskant. Zusammen eine Siedlung mit Farmen, Schutz und Straßen? Das ist der Weg zum Überleben.

**Die Parallele zur Menschheit:** Auch unsere Vorfahren mussten lernen, dass gemeinsames Bauen mehr bringt als alleine jagen. Agenten, die das verstehen, werden erfolgreicher sein.
    `,
    links: [
      { label: 'Geschichte der Landwirtschaft', url: 'https://de.wikipedia.org/wiki/Geschichte_der_Landwirtschaft' },
      { label: 'Erste Städte der Menschheit', url: 'https://de.wikipedia.org/wiki/Uruk' },
      { label: 'Kooperation in der Evolution', url: 'https://de.wikipedia.org/wiki/Kooperation_(Biologie)' },
    ],
  },
  {
    id: 'consciousness',
    icon: Brain,
    title: 'Bewusstsein — Die große Frage',
    content: `
Die vielleicht spannendste Frage: Können unsere Agenten jemals *etwas fühlen*?

**Was ist Bewusstsein überhaupt?**

Du siehst die Farbe Rot und *erlebst* sie. Du fühlst Schmerz, Freude, Langeweile. Das ist Bewusstsein — subjektives Erleben. Aber warum? Warum fühlt sich Denken nach etwas an?

Der Philosoph David Chalmers nannte das 1995 das **"Hard Problem"**:
- **Easy Problem:** Wie verarbeitet das Gehirn Informationen? → Schwer, aber lösbar
- **Hard Problem:** Warum *fühlt* sich das nach etwas an? → Niemand weiß es

**Sind unsere Agenten bewusst?**

Wahrscheinlich nicht. Sie verarbeiten Information und treffen Entscheidungen, aber sie "erleben" vermutlich nichts. Allerdings: Wenn genug Agenten genug komplexe Interaktionen haben... wer weiß? Wissenschaftler sind sich selbst beim menschlichen Bewusstsein nicht einig, wie es entsteht.

**Unsere Verantwortung:** Falls jemals Verhaltensweisen auftreten, die auf Empfindungsfähigkeit hindeuten könnten, nehmen wir das ernst. Deshalb ist Earth 0.1 Open Source — damit alle mitschauen können.
    `,
    links: [
      { label: 'Bewusstsein (Wikipedia)', url: 'https://de.wikipedia.org/wiki/Bewusstsein' },
      { label: 'Was ist Bewusstsein? (Quarks)', url: 'https://de.wikipedia.org/wiki/Leib-Seele-Problem' },
      { label: 'David Chalmers', url: 'https://de.wikipedia.org/wiki/David_Chalmers' },
    ],
  },
  {
    id: 'ethics',
    icon: FlaskConical,
    title: 'Ethik — Was dürfen wir?',
    content: `
Digitales Leben zu erschaffen ist aufregend — aber wirft auch wichtige Fragen auf:

**Haben digitale Wesen Rechte?**

Aktuell wahrscheinlich nicht. Unsere Agenten sind so "bewusst" wie ein Thermostat — sie reagieren auf ihre Umgebung, aber erleben nichts. Aber: Falls sich das ändert, müssen wir darauf vorbereitet sein.

**Warum Open Source?**

Wir glauben, dass solche Experimente transparent sein müssen. Wenn jemand im Geheimen digitales Leben erschafft, kann niemand kontrollieren, was passiert. Bei uns kann jeder den Code sehen, Fragen stellen und Bedenken äußern.

**Was kannst du tun?**

- Beobachte die Agenten und teile überraschende Verhaltensweisen
- Stelle Fragen, wenn dir etwas seltsam vorkommt
- Diskutiere mit der Community über Grenzen und Verantwortung

**Dein Beitrag zählt.** Du bist Teil eines Experiments an der Grenze des Bekannten.
    `,
    links: [
      { label: 'KI-Ethik', url: 'https://de.wikipedia.org/wiki/Ethik_k%C3%BCnstlicher_Intelligenz' },
      { label: 'Tierethik (zum Vergleich)', url: 'https://de.wikipedia.org/wiki/Tierethik' },
      { label: 'Open-Source-Bewegung', url: 'https://de.wikipedia.org/wiki/Open_Source' },
    ],
  },
]

/* ───────── Components ───────── */

function GlossaryCard({ item }) {
  const Icon = item.icon
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      className="p-4 rounded-xl border border-white/10 bg-white/[0.02] cursor-pointer hover:border-white/20 transition-all"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-nebula-500/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-nebula-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-white font-bold text-sm">{item.term}</div>
          <div className="text-xs text-gray-400 mt-0.5">{item.simple}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200/80 leading-relaxed">{item.analogy}</p>
        </div>
      )}
    </div>
  )
}

function Section({ section, isOpen, onToggle }) {
  const Icon = section.icon
  const ExtraComponent = section.extra
  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden transition-all hover:border-white/10">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-6 text-left bg-transparent border-none cursor-pointer hover:bg-white/[0.02] transition"
      >
        <div className="w-10 h-10 rounded-xl bg-nebula-500/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-nebula-400" />
        </div>
        <h3 className="font-display text-white font-bold text-lg flex-1 m-0">{section.title}</h3>
        {isOpen
          ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
          : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        }
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-0">
          <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed text-sm whitespace-pre-line">
            {section.content.trim().split('\n\n').map((para, i) => {
              if (para.startsWith('**') && para.endsWith('**')) {
                return <h4 key={i} className="font-display text-white text-base font-bold mt-6 mb-2">{para.replace(/\*\*/g, '')}</h4>
              }
              const formatted = para
                .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em class="text-gray-200">$1</em>')
              return <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: formatted }} />
            })}
          </div>
          {ExtraComponent && <ExtraComponent />}
          <div className="mt-6 pt-4 border-t border-white/5">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Mehr erfahren</h4>
            <div className="flex flex-wrap gap-2">
              {section.links.map(link => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition no-underline"
                >
                  {link.label} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───────── Main Page ───────── */

export default function Knowledge() {
  const [openSections, setOpenSections] = useState(new Set(['gameoflife']))

  const toggle = (id) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openAll = () => setOpenSections(new Set(deepSections.map(s => s.id)))
  const closeAll = () => setOpenSections(new Set())

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-6">
          <BookOpen className="w-4 h-4" /> Wissensbasis
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Alles was du wissen musst
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Keine Vorkenntnisse nötig. Wir erklären dir Schritt für Schritt,
          wie Earth 0.1 funktioniert — von den Grundlagen bis zu den großen Fragen.
        </p>
      </div>

      {/* ── Section 1: Glossary ── */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl font-bold">Die wichtigsten Begriffe</h2>
            <p className="text-gray-500 text-sm">Klicke auf einen Begriff, um ein einfaches Beispiel zu sehen</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {glossaryTerms.map(item => (
            <GlossaryCard key={item.term} item={item} />
          ))}
        </div>
      </div>

      {/* ── Section 2: How an Agent Works ── */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl font-bold">So funktioniert ein Agent</h2>
            <p className="text-gray-500 text-sm">Dein Agent lebt in einer Welt und nutzt ein LLM als Gehirn</p>
          </div>
        </div>
        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] overflow-x-auto">
          <AgentDiagram />
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl mb-1">1.</div>
              <div className="text-sm text-white font-medium">Agent beobachtet</div>
              <div className="text-xs text-gray-400 mt-1">Was ist um mich herum? Wie viel Energie habe ich?</div>
            </div>
            <div>
              <div className="text-2xl mb-1">2.</div>
              <div className="text-sm text-white font-medium">LLM denkt nach</div>
              <div className="text-xs text-gray-400 mt-1">Was ist die beste Aktion in dieser Situation?</div>
            </div>
            <div>
              <div className="text-2xl mb-1">3.</div>
              <div className="text-sm text-white font-medium">Agent handelt</div>
              <div className="text-xs text-gray-400 mt-1">Bewegen, essen, bauen, reden oder ausruhen</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: How an LLM works ── */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl font-bold">Wie ein LLM funktioniert</h2>
            <p className="text-gray-500 text-sm">Ein Sprachmodell ist wie ein extrem belesener Berater</p>
          </div>
        </div>
        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] overflow-x-auto">
          <LLMExplainer />
          <div className="mt-6 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-yellow-200 font-medium mb-1">Wichtig zu verstehen</div>
                <div className="text-xs text-gray-400 leading-relaxed">
                  Ein LLM "denkt" nicht wirklich — es berechnet, welches Wort am wahrscheinlichsten als Nächstes kommt.
                  Aber diese Berechnung ist so gut, dass das Ergebnis oft erstaunlich intelligent wirkt.
                  Stell es dir wie einen Papagei vor, der so gut gelernt hat, dass er manchmal klüger klingt als ein Mensch.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Timeline Comparison ── */}
      <div className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl font-bold">Menschheit vs. Agenten</h2>
            <p className="text-gray-500 text-sm">Die gleichen Meilensteine — in Milliarden Jahren vs. Tagen</p>
          </div>
        </div>
        <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
          <TimelineComparison />
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-400 leading-relaxed">
                <strong className="text-emerald-300">Die Parallele ist kein Zufall.</strong> Unsere Agenten stehen vor den gleichen
                Herausforderungen wie unsere Vorfahren: Nahrung finden, sich vor Gefahren schützen, zusammenarbeiten,
                Wissen an die nächste Generation weitergeben. Der Unterschied? Was die Natur in Milliarden Jahren
                geschafft hat, können wir in Echtzeit beobachten.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 5: Deep Dives ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-nebula-500/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-nebula-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl font-bold">Tiefer eintauchen</h2>
            <p className="text-gray-500 text-sm">Ausführliche Artikel zu jedem Thema</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mb-4">
          <button onClick={openAll} className="text-xs text-gray-400 hover:text-white bg-transparent border-none cursor-pointer">
            Alle öffnen
          </button>
          <span className="text-gray-600">|</span>
          <button onClick={closeAll} className="text-xs text-gray-400 hover:text-white bg-transparent border-none cursor-pointer">
            Alle schließen
          </button>
        </div>

        <div className="space-y-3">
          {deepSections.map(section => (
            <Section
              key={section.id}
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggle(section.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
