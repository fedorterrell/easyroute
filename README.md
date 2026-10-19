# Easy Route !

Une adresse, et vous obtenez un **plan d’accès A4**, une **étiquette QR** et un **message d’itinéraire** prêt à envoyer à l’équipe par WhatsApp ou e-mail.

**➜ Utiliser l’outil : https://fedorterrell.github.io/easyroute/**

Pensé pour les équipes techniques de spectacle et d’événementiel : savoir où se garer, par où décharger, où sont les loges et le catering, sans dix messages d’explication.

## Fonctions

**Plan A4 paysage** (JPG ou PNG, 3508 × 2480 px à 300 dpi)
- Vue satellite autour de l’adresse, avec les noms des rues.
- Repère rouge du lieu, que l’on peut faire glisser si la recherche l’a mal placé.
- Points utiles en couleur : accès technique / déchargement, accès personnel, catering, parking personnel, loges. Chacun a un libellé modifiable.
- Flèches dessinées à main levée pour montrer le chemin.
- Carte QR en bas à gauche, à sa taille d’impression réelle, et carte des infos pratiques à côté.
- Fond au choix : satellite, ou votre propre capture d’écran (Google Maps, plan du lieu…).

**Étiquette QR seule** (PNG, JPG ou SVG cliquable), à insérer par exemple dans Trimble LayOut.
- Le QR ouvre le lieu dans **Google Maps** ou lance le guidage dans **Waze**.
- Taille du QR de 20 à 50 mm, résolution 300 ou 600 dpi.

**Message équipe**
- Nom, adresse et infos pratiques : convocation, contact sur place, parking, code d’accès, hauteur max, consignes d’accès.
- Liens d’itinéraire **Google Maps**, **Waze** et **Plans (Apple)**, plus les coordonnées GPS, pour le lieu et pour chaque point utile.
- Boutons *Copier*, *Ouvrir dans WhatsApp*, *Envoyer par e-mail* et, sur téléphone, *Partager* (message + plan A4 en une fois).

## Utilisation

1. Saisissez le nom du lieu et l’adresse. La carte se centre toute seule après une seconde.
2. Vérifiez le repère rouge et faites-le glisser si besoin.
3. Placez les points utiles (*Placer*, puis touchez le plan) et dessinez des flèches si utile.
4. Remplissez les infos pratiques à gauche.
5. Téléchargez le plan A4, ou passez à l’onglet *Message équipe* pour l’envoyer.

## Sur iPhone

Ouvrez le site dans Safari, puis *Partager* → *Sur l’écran d’accueil*. Easy Route s’ouvre alors en plein écran, comme une application.

Le bouton *Partager* envoie le plan A4 et le message ensemble vers WhatsApp, Mail ou Photos. Si WhatsApp ne garde que l’image, copiez le message séparément.

## Structure du dépôt

| Fichier | Rôle |
| --- | --- |
| `index.html` | Toute l’application : HTML, CSS et JavaScript dans un seul fichier, sans étape de compilation. |
| `manifest.webmanifest`, `icons/` | Installation sur l’écran d’accueil (nom, icône, plein écran). |
| `fonts/` | Police facultative de l’étiquette, chargée si elle est présente (voir ci-dessous). |
| `Archive/` | Ancienne version de l’outil. |

Le site est servi par GitHub Pages depuis la branche `main` : chaque fusion sur `main` met le site à jour en une à deux minutes.

## Personnaliser

- **Ajouter un type de point utile** : ajoutez une ligne dans le tableau `POI_TYPES` de `index.html` (clé, nom, libellé par défaut, emoji, couleurs).
- **Police de l’étiquette** : l’étiquette utilise *Template Gothic* si un fichier `fonts/TemplateGothic.ttf` (ou `.otf` / `.woff2`) est présent, ou si la police est installée sur l’appareil. Sinon, elle utilise Barlow. Un fichier de police peut aussi être chargé ponctuellement depuis l’interface.

## Services externes et crédits

- **Imagerie satellite** : [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) et couches de référence Esri. La mention « Imagerie © Esri, Maxar, Earthstar Geographics » est imprimée sur chaque plan et doit y rester.
- **Recherche d’adresse** : [OpenStreetMap Nominatim](https://nominatim.org/), avec [Photon](https://photon.komoot.io/) en secours. Données © contributeurs OpenStreetMap. L’outil ne lance une recherche qu’après une pause dans la saisie, pour respecter la [politique d’usage de Nominatim](https://operations.osmfoundation.org/policies/nominatim/) (une requête par seconde au maximum).
- **QR codes** : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase, licence MIT.
- **Polices de l’interface** : Barlow et JetBrains Mono, via Google Fonts, licence SIL Open Font License.

Aucune donnée n’est envoyée à un serveur propre à Easy Route : tout se passe dans le navigateur. Seules les adresses recherchées partent vers Nominatim ou Photon, et les tuiles de carte sont demandées à Esri.

## Limites connues

- Les liens courts `maps.app.goo.gl` ne peuvent pas être générés automatiquement (Google ne propose pas d’API pour cela). On peut en coller un à la main dans *Lien personnalisé*.
- Le QR en mode Google Maps recherche le nom et l’adresse ; il ne suit pas un repère déplacé à la main. Le mode Waze et les liens du message, eux, pointent sur le repère.
- La vue satellite et la recherche d’adresse demandent une connexion internet.
