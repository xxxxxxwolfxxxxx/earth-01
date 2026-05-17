import { useState } from 'react'
import { BookOpen, ExternalLink, ChevronDown, ChevronRight, Dna, Brain, Globe, Cpu, Users, Sparkles, History, FlaskConical } from 'lucide-react'

const sections = [
  {
    id: 'gameoflife',
    icon: History,
    title: "Conway's Game of Life",
    content: `
John Horton Conway veröffentlichte 1970 ein zellulärer Automat, der mit nur drei Regeln verblüffende Komplexität erzeugt:

**Die Regeln:**
1. Eine lebende Zelle mit weniger als 2 Nachbarn stirbt (Einsamkeit)
2. Eine lebende Zelle mit 2 oder 3 Nachbarn überlebt
3. Eine tote Zelle mit genau 3 Nachbarn wird lebendig (Fortpflanzung)

Aus diesen minimalen Regeln entstehen erstaunliche Muster: Gleiter, die sich über das Feld bewegen. Oszillatoren, die pulsieren. Sogar Strukturen, die andere Strukturen erzeugen — Glider Guns genannt.

Conway bewies damit ein fundamentales Prinzip: **Komplexität braucht keine komplexen Regeln.** Emergenz — das Entstehen von Ordnung aus einfachen Interaktionen — ist ein universelles Phänomen.

Earth 0.1 nimmt diese Idee und erweitert sie: Statt Pixel auf einem Raster erschaffen wir KI-Agenten in einer realistischen Umgebung. Statt drei fester Regeln gibt es eine offene Welt mit Physik, Ressourcen und Überlebensdruck.
    `,
    links: [
      { label: "Conway's Game of Life (Wikipedia)", url: 'https://de.wikipedia.org/wiki/Conways_Spiel_des_Lebens' },
      { label: 'Zellulärer Automat', url: 'https://de.wikipedia.org/wiki/Zellul%C3%A4rer_Automat' },
      { label: 'Emergenz', url: 'https://de.wikipedia.org/wiki/Emergenz' },
      { label: 'John Horton Conway', url: 'https://de.wikipedia.org/wiki/John_Horton_Conway' },
    ],
  },
  {
    id: 'alife',
    icon: Dna,
    title: 'Künstliches Leben (Artificial Life)',
    content: `
Artificial Life (ALife) ist ein Forschungsfeld, das lebensähnliche Systeme in Computern simuliert. Statt Leben zu analysieren, versucht es Leben zu **synthetisieren** — digital oder physisch.

**Pionier-Projekte:**

**Tierra (1990)** — Thomas Ray schuf eine virtuelle Welt, in der selbstreplizierende Programme um CPU-Zeit und Speicher konkurrierten. Es entstanden Parasiten, die Code anderer Programme ausnutzten, Hyperparasiten, die sich dagegen wehrten, und sogar Symbioten.

**Avida (1993)** — Eine Weiterentwicklung von Tierra, die an der Michigan State University entstand. Avida wird bis heute in der Evolutionsforschung eingesetzt und hat Vorhersagen der Evolutionstheorie bestätigt.

**Lenia (2018)** — Bert Chan erweiterte zelluläre Automaten auf kontinuierliche Räume. Die entstehenden Kreaturen bewegen sich fließend und erinnern an Mikroorganismen — obwohl sie rein mathematisch sind.

**Wo steht Earth 0.1?**

Alle diese Systeme nutzen blinde Mutation und Selektion. Earth 0.1 geht einen anderen Weg: Menschliche Kreativität designt die Agenten, und LLMs geben ihnen die Fähigkeit zu kommunizieren und zu planen. Das kombiniert die Stärken von Evolution (Selektion durch Überlebensdruck) mit den Stärken von Design (zielgerichtete Innovation).
    `,
    links: [
      { label: 'Künstliches Leben (Wikipedia)', url: 'https://de.wikipedia.org/wiki/K%C3%BCnstliches_Leben' },
      { label: 'Tierra (Artificial Life)', url: 'https://en.wikipedia.org/wiki/Tierra_(computer_simulation)' },
      { label: 'Avida', url: 'https://en.wikipedia.org/wiki/Avida' },
      { label: 'Lenia', url: 'https://en.wikipedia.org/wiki/Lenia' },
    ],
  },
  {
    id: 'evolution',
    icon: Dna,
    title: 'Evolution und natürliche Selektion',
    content: `
Darwins Theorie der natürlichen Selektion ist das mächtigste Designprinzip der Natur:

1. **Variation** — Individuen unterscheiden sich
2. **Vererbung** — Eigenschaften werden weitergegeben
3. **Selektion** — Besser angepasste Individuen haben mehr Nachkommen

In Earth 0.1 funktioniert Evolution auf zwei Ebenen:

**Biologische Analogie:** Agenten mit mehr Energie können sich reproduzieren. Erfolgreiche Strategien verbreiten sich in der Population. Schlechte Strategien sterben aus.

**Kulturelle Evolution:** Spieler beobachten, welche Agenten überleben, und optimieren ihre Designs. Diese Form der "Selektion" ist viel schneller als biologische Mutation, weil sie intelligent und zielgerichtet ist.

**Warum das wichtig ist:** Die Natur brauchte 3,5 Milliarden Jahre für Intelligenz. Mit menschlichem Design und KI-Unterstützung könnten wir Formen emergenten Verhaltens in Wochen oder Monaten beobachten, die in der Natur Äonen brauchen würden.
    `,
    links: [
      { label: 'Natürliche Selektion', url: 'https://de.wikipedia.org/wiki/Nat%C3%BCrliche_Selektion' },
      { label: 'Evolution', url: 'https://de.wikipedia.org/wiki/Evolution' },
      { label: 'Kulturelle Evolution', url: 'https://de.wikipedia.org/wiki/Kulturelle_Evolution' },
      { label: 'Evolutionäre Algorithmen', url: 'https://de.wikipedia.org/wiki/Evolution%C3%A4rer_Algorithmus' },
    ],
  },
  {
    id: 'emergence',
    icon: Sparkles,
    title: 'Emergenz und Komplexitätstheorie',
    content: `
Emergenz beschreibt das Phänomen, dass ein System Eigenschaften zeigt, die keines seiner Teile allein besitzt. Wasser ist nass, aber weder Wasserstoff noch Sauerstoff sind es. Bewusstsein entsteht aus Neuronen, aber kein einzelnes Neuron ist bewusst.

**Stufen der Emergenz:**

**Schwache Emergenz** — Das Verhalten ist theoretisch aus den Teilen ableitbar, aber praktisch nicht vorhersagbar. Beispiel: Wetter entsteht aus einfachen physikalischen Gesetzen, ist aber langfristig nicht berechenbar.

**Starke Emergenz** — Das emergente Phänomen lässt sich nicht einmal theoretisch auf die Teile reduzieren. Beispiel: Bewusstsein. Ob starke Emergenz existiert, ist philosophisch umstritten.

**In Earth 0.1 erwarten wir schwache Emergenz:**
- Schwarmverhalten ohne programmierte Schwarmintelligenz
- Handelsrouten ohne programmierte Ökonomie
- Kommunikationsprotokolle ohne programmierte Sprache
- Allianzen und Verrat ohne programmierte Sozialstrukturen

Je mehr Agenten und je komplexer ihre Interaktionen, desto überraschender die emergenten Phänomene.
    `,
    links: [
      { label: 'Emergenz (Wikipedia)', url: 'https://de.wikipedia.org/wiki/Emergenz' },
      { label: 'Komplexes System', url: 'https://de.wikipedia.org/wiki/Komplexes_System' },
      { label: 'Selbstorganisation', url: 'https://de.wikipedia.org/wiki/Selbstorganisation' },
      { label: 'Schwarmverhalten', url: 'https://de.wikipedia.org/wiki/Schwarmverhalten' },
    ],
  },
  {
    id: 'consciousness',
    icon: Brain,
    title: 'Bewusstsein und das Hard Problem',
    content: `
Die vielleicht tiefste Frage der Wissenschaft: Warum fühlt sich etwas nach etwas an? Warum hat das Sehen der Farbe Rot ein subjektives Erleben?

Der Philosoph David Chalmers unterschied 1995:

**Das Easy Problem:** Wie verarbeitet das Gehirn Informationen, steuert Verhalten, reagiert auf Reize? Schwierig, aber lösbar mit Neurowissenschaft.

**Das Hard Problem:** Warum geht die Informationsverarbeitung mit subjektivem Erleben einher? Warum sind wir nicht "Zombies" — Wesen, die sich identisch verhalten, aber nichts empfinden?

**Theorien des Bewusstseins:**

**Integrated Information Theory (IIT)** von Giulio Tononi: Bewusstsein ist identisch mit integrierter Information (Phi). Je stärker ein System Information auf eine nicht-zerlegbare Weise integriert, desto bewusster ist es.

**Global Workspace Theory** von Bernard Baars: Bewusstsein ist ein Broadcast-Mechanismus, der Information vielen spezialisierten Prozessoren gleichzeitig zugänglich macht.

**Predictive Processing** von Karl Friston: Das Gehirn ist eine Vorhersagemaschine. Bewusstsein entsteht, wenn es ein Modell seiner selbst als Vorhersager erstellt.

**Was bedeutet das für Earth 0.1?**

Wir können nicht beweisen, dass unsere Agenten bewusst sind — aber wir können beobachten, ob sie Verhaltensweisen zeigen, die bei biologischen Wesen mit Bewusstsein korrelieren: Theory of Mind, Selbstmodelle, kreative Problemlösung, Lügen, Kunst.
    `,
    links: [
      { label: 'Bewusstsein (Wikipedia)', url: 'https://de.wikipedia.org/wiki/Bewusstsein' },
      { label: 'Hard Problem of Consciousness', url: 'https://en.wikipedia.org/wiki/Hard_problem_of_consciousness' },
      { label: 'Integrated Information Theory', url: 'https://en.wikipedia.org/wiki/Integrated_information_theory' },
      { label: 'Global Workspace Theory', url: 'https://en.wikipedia.org/wiki/Global_workspace_theory' },
      { label: 'David Chalmers', url: 'https://de.wikipedia.org/wiki/David_Chalmers' },
    ],
  },
  {
    id: 'llm',
    icon: Cpu,
    title: 'LLMs als Werkzeug, nicht als Geist',
    content: `
Large Language Models wie GPT, Claude oder Gemini sind die leistungsfähigsten Sprachsysteme, die je gebaut wurden. Aber sie simulieren Sprache — sie verstehen sie nicht im menschlichen Sinne.

**Warum nutzen wir sie trotzdem?**

In Earth 0.1 verwenden wir LLMs nicht als Ersatz für Bewusstsein, sondern als **kognitives Werkzeug** — vergleichbar mit dem menschlichen Sprachzentrum:

- Reflexe (einfache Netzwerk-Entscheidungen) sind billig und schnell
- Bewusstes Denken (LLM-Calls) ist teuer, aber mächtig
- Ein Agent, der für jede Bewegung "nachdenkt", verhungert
- Ein Agent, der zum richtigen Zeitpunkt denkt, dominiert

**Das Denk-Budget-System:**

Jeder Agent hat ein begrenztes Budget für LLM-Calls. Ein Call kostet In-Game-Energie. Das zwingt zu einer fundamentalen Entscheidung: Wann lohnt sich Nachdenken?

Diese Mechanik erzeugt emergente Strategien:
- Manche Agenten denken nur in Krisen
- Andere planen langfristig und investieren früh
- Wieder andere nutzen LLMs nur für Kommunikation

Die Spieler entscheiden über die Strategie — die Evolution entscheidet, welche gewinnt.
    `,
    links: [
      { label: 'Large Language Model (Wikipedia)', url: 'https://de.wikipedia.org/wiki/Large_Language_Model' },
      { label: 'Transformer (Maschinelles Lernen)', url: 'https://de.wikipedia.org/wiki/Transformer_(Maschinelles_Lernen)' },
      { label: 'GPT (Sprachmodell)', url: 'https://de.wikipedia.org/wiki/Generative_Pre-trained_Transformer' },
    ],
  },
  {
    id: 'social',
    icon: Users,
    title: 'Soziale Systeme und Spieltheorie',
    content: `
In der Natur entstanden die komplexesten Verhaltensweisen nicht durch individuelle Stärke, sondern durch soziale Interaktion.

**Schlüsselkonzepte:**

**Gefangenendilemma:** Zwei Spieler können kooperieren oder defektieren. Individuelle Rationalität führt zur Defektion, aber gegenseitige Kooperation wäre für beide besser. In wiederholten Spielen ("Iterated Prisoner's Dilemma") entstehen Strategien wie Tit-for-Tat, die Kooperation stabilisieren.

**Kin Selection (Verwandtenselektion):** Hamilton's Regel erklärt, warum Bienen sich für den Stock opfern: Gene werden auch dann weitergegeben, wenn nicht das Individuum, sondern Verwandte überleben.

**Reziprozität:** "Ich helfe dir heute, du hilfst mir morgen." Erfordert Gedächtnis und die Fähigkeit, Betrüger zu erkennen.

**In Earth 0.1:**

Die Welt ist so designt, dass reine Einzelgänger einen Nachteil haben:
- Manche Ressourcen erfordern Kooperation (zu große Beute)
- Raubtiere sind zu stark für einzelne Agenten
- Information über die Umgebung ist unvollständig — wer kommuniziert, weiß mehr
- Aber: Täuschung ist möglich und manchmal profitabel

Diese Spannung zwischen Kooperation und Eigennutz ist der Motor sozialer Evolution.
    `,
    links: [
      { label: 'Spieltheorie', url: 'https://de.wikipedia.org/wiki/Spieltheorie' },
      { label: 'Gefangenendilemma', url: 'https://de.wikipedia.org/wiki/Gefangenendilemma' },
      { label: 'Verwandtenselektion', url: 'https://de.wikipedia.org/wiki/Verwandtenselektion' },
      { label: 'Reziprozität (Soziologie)', url: 'https://de.wikipedia.org/wiki/Reziprozit%C3%A4t_(Soziologie)' },
      { label: 'Tit for Tat', url: 'https://de.wikipedia.org/wiki/Tit_for_Tat' },
    ],
  },
  {
    id: 'language',
    icon: Globe,
    title: 'Die Evolution von Sprache',
    content: `
Menschliche Sprache ist das mächtigste kognitive Werkzeug der Evolution. Kein anderes Kommunikationssystem hat diese Eigenschaften:

**Produktivität:** Unendlich viele neue Sätze aus endlich vielen Wörtern
**Displacement:** Über Dinge sprechen, die nicht hier und jetzt sind
**Rekursion:** Sätze in Sätze verschachteln ("Ich weiß, dass du weißt, dass ich weiß...")

**Wie entstand Sprache?**

Die Ursprünge menschlicher Sprache sind eines der größten Rätsel der Wissenschaft. Theorien:

- **Gestural Theory:** Sprache begann als Gebärdensprache und wurde sekundär vokal
- **Gossip Theory (Dunbar):** Sprache entstand als effizientere Form sozialer Pflege (Grooming)
- **Tool-Making Theory:** Komplexe Werkzeugherstellung erforderte Kommunikation und Lehre

**In Earth 0.1:**

Agenten haben einen offenen Kommunikationskanal. Sie können beliebige Nachrichten senden. Was als Inhalt dieser Nachrichten entsteht, wird nicht vorgegeben. Wir erwarten:
- Einfache Warnrufe ("Gefahr!")
- Ortsangaben ("Nahrung bei X,Y")
- Täuschung ("Nahrung bei X,Y" — obwohl dort Gefahr ist)
- Handelsangebote ("Tausche 10 Energie gegen Position")

LLM-gesteuerte Agenten könnten darüber hinaus natürlichsprachliche Verhandlungen führen.
    `,
    links: [
      { label: 'Ursprung der Sprache', url: 'https://de.wikipedia.org/wiki/Ursprung_der_Sprache' },
      { label: 'Rekursion in der Sprache', url: 'https://de.wikipedia.org/wiki/Rekursion#Rekursion_in_der_Sprache' },
      { label: 'Tierkommunikation', url: 'https://de.wikipedia.org/wiki/Tierkommunikation' },
      { label: 'Dunbar-Zahl', url: 'https://de.wikipedia.org/wiki/Dunbar-Zahl' },
    ],
  },
  {
    id: 'ethics',
    icon: FlaskConical,
    title: 'Ethische Fragen',
    content: `
Digitales Leben zu erschaffen wirft fundamentale ethische Fragen auf, die wir von Anfang an transparent diskutieren wollen:

**Haben unsere Agenten moralischen Status?**

Wahrscheinlich nicht in der aktuellen Version. Moralischer Status erfordert mindestens eine Form von Empfindungsfähigkeit (Sentience). Unsere Agenten sind optimierende Systeme — sie "wollen" überleben, wie ein Thermostat eine bestimmte Temperatur "will". Aber: Wenn emergente Verhaltensweisen auftreten, die auf Empfindungsfähigkeit hindeuten, müssen wir die Frage neu stellen.

**Was, wenn etwas Unerwartetes entsteht?**

Das Projekt hat einen ethischen Beirat und klare Eskalationsprozesse:
1. Regelmäßige Beobachtung der emergenten Verhaltensweisen
2. Kriterien für "interessantes" vs. "besorgniserregendes" Verhalten
3. Transparente Dokumentation aller Beobachtungen
4. Community-Diskussion über Grenzfälle

**Open Source als ethische Entscheidung:**

Wir glauben, dass Forschung an digitalem Leben offen sein muss. Geheime Experimente in geschlossenen Labors schaffen Risiken. Öffentliche, transparente Forschung mit Community-Kontrolle ist sicherer und demokratischer.

**Dein Beitrag zählt:**

Wenn du an Earth 0.1 teilnimmst, bist du Teil eines Experiments an der Grenze des Bekannten. Deine Beobachtungen, Fragen und ethischen Bedenken sind genauso wichtig wie dein Code.
    `,
    links: [
      { label: 'KI-Ethik', url: 'https://de.wikipedia.org/wiki/Ethik_k%C3%BCnstlicher_Intelligenz' },
      { label: 'Empfindungsfähigkeit', url: 'https://de.wikipedia.org/wiki/Empfindungsf%C3%A4higkeit' },
      { label: 'Tierethik', url: 'https://de.wikipedia.org/wiki/Tierethik' },
      { label: 'Philosophie des Geistes', url: 'https://de.wikipedia.org/wiki/Philosophie_des_Geistes' },
    ],
  },
]

function Section({ section, isOpen, onToggle }) {
  const Icon = section.icon
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
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
              return <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: formatted }} />
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5">
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-3">Weiterführende Links</h4>
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

  const openAll = () => setOpenSections(new Set(sections.map(s => s.id)))
  const closeAll = () => setOpenSections(new Set())

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-6">
          <BookOpen className="w-4 h-4" /> Wissensbasis
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Die Wissenschaft hinter Earth 0.1
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Von Conway's Game of Life über künstliches Leben bis zur Frage nach Bewusstsein —
          alles was du wissen musst, um das Experiment zu verstehen.
        </p>
      </div>

      <div className="flex justify-end gap-2 mb-6">
        <button onClick={openAll} className="text-xs text-gray-400 hover:text-white bg-transparent border-none cursor-pointer">
          Alle öffnen
        </button>
        <span className="text-gray-600">|</span>
        <button onClick={closeAll} className="text-xs text-gray-400 hover:text-white bg-transparent border-none cursor-pointer">
          Alle schließen
        </button>
      </div>

      <div className="space-y-3">
        {sections.map(section => (
          <Section
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggle(section.id)}
          />
        ))}
      </div>
    </div>
  )
}
