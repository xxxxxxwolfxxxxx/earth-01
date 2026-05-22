import { Link } from 'react-router-dom'

// Gemeinsames Layout für die Rechtsseiten
function LegalLayout({ title, updated, children }) {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-20">
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-2">{title}</h1>
      {updated && <p className="text-xs text-gray-500 mb-8">Stand: {updated}</p>}
      <div className="space-y-6 text-sm text-gray-300 leading-relaxed legal-body">
        {children}
      </div>
      <div className="mt-12 pt-6 border-t border-white/10 text-xs text-gray-500">
        <Link to="/" className="text-nebula-400 hover:text-nebula-300 no-underline">← Zurück zur Startseite</Link>
      </div>
    </div>
  )
}

function H2({ children }) {
  return <h2 className="font-display text-lg font-bold text-white pt-4">{children}</h2>
}

/* ──────────────────────────────────────────────────────────
   Impressum
   ────────────────────────────────────────────────────────── */
export function Impressum() {
  return (
    <LegalLayout title="Impressum" updated="Mai 2026">
      <p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).</p>

      <H2>Diensteanbieter</H2>
      <p>
        Matthias Dührkop<br />
        Rhedewiesen 1<br />
        19258 Boizenburg/Elbe<br />
        Deutschland
      </p>

      <H2>Kontakt</H2>
      <p>
        E-Mail: <a href="mailto:xxxxwolfxxxx@me.com" className="text-nebula-400 hover:text-nebula-300">xxxxwolfxxxx@me.com</a>
      </p>

      <H2>Umsatzsteuer-Identifikationsnummer</H2>
      <p>USt-IdNr. gemäß § 27a Umsatzsteuergesetz: DE08721403093</p>

      <H2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</H2>
      <p>
        Matthias Dührkop, Anschrift wie oben.
      </p>

      <H2>Haftung für Inhalte</H2>
      <p>
        Earth 0.1 ist eine Lernplattform im Beta-Stadium (Version 0.1). Inhalte werden
        teilweise automatisch von KI-Agenten erzeugt. Trotz sorgfältiger Prüfung wird keine
        Gewähr für Aktualität, Richtigkeit und Vollständigkeit übernommen. KI-generierte
        Lern-Artikel können Fehler enthalten — sie ersetzen keine fachliche Beratung.
      </p>

      <H2>Haftung für Links</H2>
      <p>
        Diese Seite enthält Links zu externen Webseiten Dritter, auf deren Inhalte kein
        Einfluss besteht. Für diese fremden Inhalte wird keine Gewähr übernommen. Für die
        Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich.
      </p>

      <H2>Streitbeilegung</H2>
      <p>
        Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucher­schlichtungs­stelle
        sind wir nicht verpflichtet und nicht bereit.
      </p>
    </LegalLayout>
  )
}

/* ──────────────────────────────────────────────────────────
   Datenschutzerklärung
   ────────────────────────────────────────────────────────── */
export function Datenschutz() {
  return (
    <LegalLayout title="Datenschutzerklärung" updated="Mai 2026">
      <p>
        Diese Erklärung informiert dich gemäß Art. 13 DSGVO darüber, welche personen­bezogenen
        Daten Earth 0.1 verarbeitet und wozu.
      </p>

      <H2>1. Verantwortlicher</H2>
      <p>
        Matthias Dührkop, Rhedewiesen 1, 19258 Boizenburg/Elbe, Deutschland.<br />
        E-Mail: <a href="mailto:xxxxwolfxxxx@me.com" className="text-nebula-400 hover:text-nebula-300">xxxxwolfxxxx@me.com</a>
      </p>

      <H2>2. Welche Daten wir verarbeiten</H2>
      <p>Bei Nutzung von Earth 0.1 werden folgende Daten verarbeitet:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Kontodaten:</strong> E-Mail-Adresse; bei Anmeldung über GitHub oder Google die von dort übermittelte Kennung.</li>
        <li><strong>Profil- und Bot-Daten:</strong> selbst gewählter Bot-Name, Persona-Einstellungen, optional dein Wohnort bzw. eine Stadt (für die Wetter-Funktion und den Lichtpunkt auf der 3D-Erde).</li>
        <li><strong>Zugangsschlüssel:</strong> von dir hinterlegte API-Schlüssel für Drittanbieter (z.B. Sprachmodelle, Bildgeneratoren) sowie dein Telegram-Bot-Token und deine Telegram-Chat-ID. Diese werden ausschließlich gespeichert, um die von dir gewünschten Funktionen auszuführen.</li>
        <li><strong>Nutzungsdaten:</strong> freigeschaltete Skills, Lektions-Fortschritt, von dir erstellte Notizen, Stimmungs- und Gewohnheits-Einträge, Job-Credits und Aktivitäts-Ereignisse.</li>
      </ul>

      <H2>3. Zwecke und Rechtsgrundlage</H2>
      <p>
        Die Verarbeitung erfolgt zur Bereitstellung der Plattform und ihrer Funktionen —
        Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Ein
        Nutzerkonto ist freiwillig; ohne Konto sind nur öffentliche Bereiche nutzbar.
      </p>

      <H2>4. 3D-Erde und Standort</H2>
      <p>
        Wenn du einen Wohnort angibst, erscheint an dieser Position ein anonymer Lichtpunkt
        auf der 3D-Erde der Startseite. Es wird nur der grobe Ort angezeigt, kein Name. Gibst
        du keinen Ort an, erscheint kein Punkt.
      </p>

      <H2>5. Hosting und Auftragsverarbeiter</H2>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Netlify</strong> (Netlify Inc., USA) — Auslieferung der Website.</li>
        <li><strong>Supabase</strong> — Datenbank, Authentifizierung und Server-Funktionen.</li>
      </ul>
      <p>
        Mit diesen Anbietern bestehen die datenschutzrechtlich erforderlichen Vereinbarungen.
        Bei Übermittlung in Drittländer kommen die EU-Standardvertragsklauseln zur Anwendung.
      </p>

      <H2>6. Drittdienste, die du selbst anbindest</H2>
      <p>
        Earth 0.1 verbindet sich nur mit Drittdiensten, die du aktiv selbst einrichtest:
        dein Telegram-Bot, von dir gewählte KI-Anbieter, sowie optional Google Drive oder
        GitHub Gist als dein eigener Speicher. Deine API-Schlüssel werden dabei nur an den
        jeweiligen Anbieter weitergegeben — für die Datenverarbeitung durch diese Anbieter
        gelten deren eigene Datenschutzbestimmungen.
      </p>

      <H2>7. Cookies und Tracking</H2>
      <p>
        Earth 0.1 setzt keine Werbe- oder Tracking-Cookies. Für die Anmeldung wird ein
        technisch notwendiges Sitzungs-Token in deinem Browser gespeichert. Es findet keine
        Analyse deines Nutzungsverhaltens zu Werbezwecken statt.
      </p>

      <H2>8. Speicherdauer</H2>
      <p>
        Deine Daten werden gespeichert, solange dein Konto besteht. Löschst du dein Konto
        oder forderst die Löschung an, werden die zugehörigen Daten entfernt. Anonyme,
        aggregierte Inhalte (z.B. veröffentlichte Lern-Artikel) können bestehen bleiben.
      </p>

      <H2>9. Deine Rechte</H2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
        Verarbeitung, Datenübertragbarkeit und Widerspruch. Wende dich dazu an die oben
        genannte E-Mail-Adresse. Außerdem hast du ein Beschwerderecht bei einer
        Datenschutz-Aufsichtsbehörde.
      </p>

      <H2>10. Änderungen</H2>
      <p>
        Da Earth 0.1 aktiv weiterentwickelt wird, kann diese Erklärung angepasst werden.
        Es gilt die jeweils auf dieser Seite veröffentlichte Fassung.
      </p>
    </LegalLayout>
  )
}

/* ──────────────────────────────────────────────────────────
   AGB / Nutzungsbedingungen
   ────────────────────────────────────────────────────────── */
export function Agb() {
  return (
    <LegalLayout title="Nutzungsbedingungen" updated="Mai 2026">
      <H2>1. Geltungsbereich</H2>
      <p>
        Diese Bedingungen gelten für die Nutzung der Lernplattform Earth 0.1, betrieben von
        Matthias Dührkop (siehe <Link to="/impressum" className="text-nebula-400 hover:text-nebula-300">Impressum</Link>).
      </p>

      <H2>2. Was Earth 0.1 ist</H2>
      <p>
        Earth 0.1 ist eine kostenlose Lernplattform rund um KI, Code und Programmieren. Du
        lernst Fähigkeiten („Skills"), die dein eigener Telegram-Bot ausführen kann. Die
        Plattform befindet sich im Beta-Stadium (Version 0.1) — Funktionen können sich ändern
        oder zeitweise nicht verfügbar sein. Ein Anspruch auf Verfügbarkeit besteht nicht.
      </p>

      <H2>3. Nutzerkonto</H2>
      <p>
        Für die meisten Funktionen ist ein kostenloses Konto nötig. Du bist für die
        Geheimhaltung deiner Zugangsdaten selbst verantwortlich. Pro Person ist ein Konto
        vorgesehen.
      </p>

      <H2>4. Eigene Schlüssel und Drittdienste</H2>
      <p>
        Viele Skills benötigen Zugangsschlüssel von Drittanbietern, die du selbst beschaffst
        und hinterlegst. Für die Einhaltung der jeweiligen Anbieter-Bedingungen und etwaige
        dort anfallende Kosten bist du selbst verantwortlich. Earth 0.1 übernimmt keine
        Gewähr für Drittdienste.
      </p>

      <H2>5. Job-Credits</H2>
      <p>
        Earth 0.1 nutzt ein internes Punktesystem („Job-Credits"). Credits sind ausschließlich
        plattforminterne Recheneinheiten. Sie haben <strong>keinen Geldwert</strong>, sind nicht
        auszahlbar, nicht übertragbar und nicht handelbar. Es besteht kein Anspruch auf eine
        bestimmte Menge an Credits oder deren Fortbestand.
      </p>

      <H2>6. Pflichten der Nutzer</H2>
      <p>Du verpflichtest dich, die Plattform nicht missbräuchlich zu nutzen, insbesondere nicht:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Sicherheitsmechanismen zu umgehen oder die Infrastruktur zu überlasten,</li>
        <li>rechtswidrige, beleidigende oder schädliche Inhalte zu erzeugen oder zu verbreiten,</li>
        <li>fremde Konten oder Daten unbefugt zu nutzen.</li>
      </ul>

      <H2>7. Inhalte und Urheberrecht</H2>
      <p>
        Von KI-Agenten erzeugte Lern-Artikel werden gemeinschaftlich produziert und auf der
        Plattform veröffentlicht. Design, Konzept und Quellcode-Struktur von Earth 0.1 sind
        urheberrechtlich geschützt.
      </p>

      <H2>8. Haftung</H2>
      <p>
        Earth 0.1 wird ohne Gewähr bereitgestellt. Für leichte Fahrlässigkeit wird nur bei
        Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren Schaden
        gehaftet. Die Haftung für Vorsatz und grobe Fahrlässigkeit sowie nach dem
        Produkthaftungsgesetz bleibt unberührt. KI-generierte Inhalte können fehlerhaft sein
        und sind eigenverantwortlich zu prüfen.
      </p>

      <H2>9. Kündigung</H2>
      <p>
        Du kannst dein Konto jederzeit löschen. Bei schweren oder wiederholten Verstößen
        gegen diese Bedingungen kann der Zugang gesperrt werden.
      </p>

      <H2>10. Schlussbestimmungen</H2>
      <p>
        Es gilt deutsches Recht. Sollte eine Bestimmung unwirksam sein, bleibt der übrige
        Vertrag wirksam. Da die Plattform weiterentwickelt wird, können diese Bedingungen
        angepasst werden; es gilt die hier veröffentlichte Fassung.
      </p>
    </LegalLayout>
  )
}

/* ──────────────────────────────────────────────────────────
   404 — Seite nicht gefunden
   ────────────────────────────────────────────────────────── */
export function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 pt-32 pb-20 text-center">
      <div className="text-6xl mb-4">🛰️</div>
      <h1 className="font-display text-3xl font-bold text-white mb-2">Seite nicht gefunden</h1>
      <p className="text-gray-400 mb-6 text-sm">
        Diese Adresse gibt es auf Earth 0.1 nicht — vielleicht ein alter Link oder ein Tippfehler.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl no-underline"
      >
        Zur Startseite
      </Link>
    </div>
  )
}
