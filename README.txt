Weihnachtskasse – eigenständige PWA-Sonderedition (1.0.3)

Diese Version wurde aus der hochgeladenen Lernkasse erstellt. Die hochgeladene Originalversion bleibt unverändert.

INSTALLATION / GITHUB PAGES
Die Dateien dieses Ordners zusammen in einem eigenen Unterordner (z. B. /weihnachtskasse/) oder einem eigenen Repository veröffentlichen. index.html muss im Stamm dieses Variantenordners liegen. Nicht über die Original-PWA kopieren. In HTTPS/GitHub Pages installieren oder offline nach dem ersten Laden verwenden.

ARTIKEL / EINSTELLUNGEN
- Beim ersten Start sind genau zwei Platzhalterartikel vorhanden: „Artikel 1“ (1,00 €), „Artikel 2“ (2,00 €).
- Über ⚙️ Einstellungen und den bisherigen Einstellungs-Code können Namen und Grundpreise geändert, neue Artikel hinzugefügt, Artikel entfernt und eigene Fotos hochgeladen werden.
- Klein (grün), Mittel (gelb) und Groß (rosa) werden für JEDEN Artikel separat ein- oder ausgeschaltet. Jede Größe hat pro Artikel einen eigenen Preis. Grundeinstellung: Größen ausgeschaltet.
- Sobald für einen Artikel mindestens eine Größe aktiv ist, wird NUR für diesen Artikel der dunkelgrüne Grundpreis nicht mehr angezeigt oder gebucht; nur seine aktivierten Größen sind auswählbar. Für andere Artikel ohne Größen bleibt deren Grundpreis sichtbar.
- Das Produkteraster passt sich automatisch an die Anzahl der Artikel und die verfügbare Bildschirmfläche an. Weniger Artikel erhalten größere Produktkacheln; bei vielen Artikeln kann die Artikelliste scrollen. Ohne Größen füllt der Grundpreisbutton den gemeinsamen Preisbereich aus. Dadurch stehen die Artikelnamen auf einer Höhe. Der Bezahlvorgang bleibt unverändert.
- Änderungen werden automatisch im Browser gespeichert. Artikel und Preise im localStorage der *Weihnachtskasse*, hochgeladene Bilder in IndexedDB. Dies ist keine Speicherung in den Ordnern des Webservers. Bei Löschen der Website-Daten oder in anderen Browsern/Endgeräten stehen diese Einstellungen nicht zur Verfügung.
- Geldabbildungen aus der Original-App befinden sich ausschließlich im Ordner icons/. Ursprüngliche Lebensmittelbilder wurden vollständig entfernt.
- Der Bezahlvorgang nutzt dieselben Bildschirm-Elemente und Geldabbildungen wie die Original-App; nur zur Vermeidung des Scrollens wird seine Anzeige auf kleineren Bildschirmen proportional angepasst.
- Übungsmodus, Wechselgeldfunktion, Vorlesefunktion und Verkaufsprotokoll sind erhalten.
- Der Abschiedsgruß wird ausschließlich bei Klick auf den Lautsprecherbutton 🔊 auf dem Abschlussbildschirm vorgelesen; der Weiter-Button bleibt stumm.

ISOLIERUNG VON DER ORIGINALVERSION
Eigene Manifest-ID, eigener Service-Worker-Cache (weihnachtskasse-*) und eigene Speicher-Namen. Die Service-Worker-Aktivierung löscht keine Caches der Originalkasse.

HINWEIS: Beim Betrieb durch file:// (Doppelklick) kann die App geöffnet werden; PWA-Installation und Offline-Cache benötigen HTTPS oder localhost.
