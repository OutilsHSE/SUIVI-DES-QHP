# Suivi des QHP — CDES

Outil du service HSE : fiches de Quart d'Heure Prévention (saisie, photo ou PDF de la fiche signée, lecture automatique), fiche d'émargement signable au doigt pour les animateurs (conducteurs de travaux), suivi annuel de participation (un mois au clic), participants ajoutés d'une touche. V3.4.1 du 20/10/2026 (menu d'une case court ; rythme « 1 QHP / 4 mois » par collaborateur, hors % mensuel ; N/A enregistré de façon fiable ; suppression fiable pendant une synchro ; doublons probables dans l'historique ; dates des fiches réparées, filtre par animateur ; un seul bandeau de scan, une ou plusieurs fiches : certitude, Vérifier ou Envoyer ; import de lots de fiches transcrites).

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `css/qhp.css` | Apparence |
| `js/qhp.js` | Fonctionnement : fiches, émargement, bilans, synchronisation |
| `js/logo.js` | Logo CDES intégré (image) |
| `data/listes.json` | Secteurs et agences, modifiables sans toucher au code |

## Ce que ce dépôt ne contient pas, volontairement

- **Aucune liste de personnes** : les collaborateurs viennent uniquement du serveur (onglet ROSTER du classeur privé), par la synchronisation, et seulement pour un appareil branché.
- **Aucune adresse de serveur ni aucun mot de passe** : un appareil se branche en ouvrant l'outil depuis l'intranet HSE (tuiles « Suivi des QHP » et « Fiche d'émargement QHP »), jamais par un lien publié.
- **Aucun code serveur** (`.gs`) : il est versionné à part, dans un dépôt privé.

Tout fichier de ce dépôt est public : `data/listes.json` ne doit contenir que des listes non sensibles.
