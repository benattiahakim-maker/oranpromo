# Dossier pour le rendez-vous avec l'avocat ou l'expert-comptable (Oran)

> Préparé le 10/10/2026 pour la carte Trello « Juridique · Rendez-vous avocat ou expert-comptable à Oran (loi 18-05, ANPDP) ». Ce dossier **ne donne aucun conseil juridique** : il présente BleDeal et liste les questions à poser.
> **« Vérifié »** = lu dans le texte officiel (Journal officiel, JORADP) ou sur le site officiel cité. **« Non vérifié »** = trouvé dans une source secondaire ou pas trouvé du tout : à confirmer par l'avocat. Aucun contenu d'article n'est inventé : quand un article n'a pas été lu, le dossier le dit.
> Textes déjà rédigés (brouillons publiés avec le bandeau « Version provisoire, en cours de relecture juridique ») : `conditions-utilisation.md`, `conditions-commercants.md`, `confidentialite.md` (PR #109 et #113). Brouillon d'accord avec les boutiques : `accord-boutiques-bons.md`.

## 1. BleDeal en une page

**Ce que c'est.** BleDeal (anciennement OranPromo) est un site web, pensé pour le téléphone, qui montre les **promos des boutiques de quartier** : mode femme, homme, enfant, et beauté (parfums, maquillage). Il est en **français et en arabe**. **Oran** est la seule ville ouverte (9 villes sont prévues).

**Comment ça marche.**
1. Le client trouve un article sur le site (catalogue, carte des boutiques, recherche) et le **réserve** en ligne (panier d'une seule boutique).
2. La boutique confirme, prépare, puis passe la commande « prête ». Les messages partent par **WhatsApp** (API WhatsApp Cloud de Meta).
3. Le client vient en boutique, montre son **QR code de retrait** (ou donne un code à 6 chiffres) et **paie en espèces à la boutique**.
4. **BleDeal ne vend rien et n'encaisse rien.** Le site ne fait aucun paiement en ligne. La boutique vend en son nom.

**Comptes.** Clients : numéro WhatsApp vérifié par un code envoyé sur WhatsApp (connexion codée, pas encore en service ; aujourd'hui, lien par e-mail). Commerçants : e-mail. Règles anti-abus : un client qui ne vient pas 5 fois est bloqué (« no-show »), avec contestation possible.

**Bons de réduction (payés par BleDeal).**

| Bon | Montant | État au 10/10/2026 |
| --- | --- | --- |
| Parrainage (parrain et filleul) | 300 DA chacun, sur une commande d'au moins 1 000 DA ; validé par une 1re commande du filleul d'au moins 2 000 DA | **en service** (interrupteur `parrainage` = `on` en production) ; budget de départ 30 000 DA par mois |
| Bienvenue (1re commande) | 300 DA dès 2 000 DA d'achat | prévu (US-33), pas encore codé |
| Campagnes (Aïd, rentrée…) | 500 DA, au plus 30 bons par boutique et par campagne | prévu (US-33), pas encore codé |
| Avis sur une boutique | 150 DA dès 1 500 DA, au plus 2 par mois et par numéro | prévu (US-32), pas encore codé |

Le client présente le bon, la boutique le **déduit en caisse**, puis **BleDeal rembourse la boutique** chaque mois (relevé clôturé le 1er, paiement avant le 10, par CCP, BaridiMob ou virement, en dehors du site). Seule une commande **remise par QR code** donne droit au remboursement.

**Données traitées.** Clients : numéro WhatsApp, nom ou prénom, commandes, bons, parrainages, avis, boutiques suivies. Commerçants : e-mail, nom, boutique, adresse, WhatsApp, photos. Statistiques de visite avec une **empreinte** de l'adresse IP (pas l'adresse elle-même). La position du téléphone (« Autour de moi ») reste dans le téléphone.

**Hébergement et prestataires : tous hors d'Algérie.** Supabase (base de données, région Paris), Vercel (site), Meta (WhatsApp), Twilio Verify (codes de connexion), Cloudflare Turnstile (captcha), CARTO (fond de carte), Anthropic (aide à la rédaction des fiches à partir des photos des commerçants).

**Où on en est.** Le site **n'est pas encore ouvert au grand public**, et la carte Trello dit : « Ne pas ouvrir au grand public avant d'avoir les réponses. » Le domaine prévu, `bledeal.com`, n'est pas encore acheté. Les textes juridiques sont en ligne en version provisoire. Société : `[à compléter : pas encore créée ? raison sociale, RC, NIF, adresse]`. Associé : `[à compléter : l'un des associés réside-t-il hors d'Algérie ?]` (question n° 2 de la carte Trello). Revenus : `[à compléter : gratuit pendant le lancement ? abonnement des boutiques plus tard ?]`.

## 2. Questions à poser

### A. Commerce électronique (loi 18-05) : BleDeal est-il un « e-fournisseur » ?

Ce que dit le texte (**vérifié**, JORA n° 28 du 16 mai 2018) :
- **Art. 6** : l'e-fournisseur est « toute personne physique ou morale qui commercialise ou propose la fourniture des biens ou des services par voie de communications électroniques ».
- **Art. 8** : l'activité de commerce électronique est soumise à l'inscription au registre du commerce (ou de l'artisanat et des métiers) et à la publication d'un site « hébergé en Algérie avec une extension « .com.dz » » ; le site doit être muni d'outils permettant son authentification.
- **Art. 9** : un fichier national des e-fournisseurs est tenu au **CNRC** ; l'exercice de l'activité est « subordonné au dépôt du nom de domaine auprès des services du centre national du registre du commerce ».
- Aussi : art. 11 (NIF, RC, adresses et téléphone de l'e-fournisseur dans l'offre), art. 20 (facture), art. 25 (garder les registres des transactions et les transmettre au CNRC), art. 26 (données personnelles), art. 30 (publicité et offres promotionnelles : conditions ni trompeuses ni ambiguës).

Questions :
1. BleDeal ne vend rien, n'encaisse rien et ne livre rien : le client réserve en ligne et **paie en boutique**. Est-il quand même un e-fournisseur (il « propose » les articles des boutiques en ligne) ? Ou un simple **service** (vitrine et réservation) rendu aux boutiques ?
2. Si BleDeal est e-fournisseur : quel **code d'activité** au registre du commerce ? Faut-il aussi s'inscrire au fichier national des e-fournisseurs (art. 9) ?
3. Les **boutiques** deviennent-elles des e-fournisseurs parce que leurs articles sont réservables sur BleDeal ? Doivent-elles chacune avoir un site « .com.dz » ? Que doivent-elles faire ?
4. **Nom de domaine** : faut-il un « .com.dz » (par exemple `bledeal.com.dz`) **en plus** ou **à la place** de `bledeal.com` ? Peut-on garder `bledeal.com` et rediriger ? Comment se fait le dépôt du nom de domaine au CNRC (art. 9) ? Le « .dz » s'achète-t-il auprès du registre algérien (`nic.dz`, CERIST) ? (**non vérifié**)
5. **Hébergement en Algérie** (art. 8) : faut-il déplacer le site et la base en Algérie ? Le site seulement, ou aussi la base de données ? Délai pour se mettre en règle ? Quels hébergeurs algériens sont acceptés ?
6. Art. 25 : quels **registres de transactions** garder, combien de temps, et sous quelle forme les transmettre au CNRC (les modalités sont renvoyées à un texte réglementaire : lequel ? **non trouvé**) ?
7. Art. 11 et 20 : quelles mentions afficher sur le site, et qui établit la **facture** au client (la boutique, à notre avis) ?
8. Sanctions (art. 37 à 48 cités dans `README.md`, **non relus pour ce dossier**) : que risque-t-on si on ouvre le site tel quel ?

### B. Données personnelles (loi 18-07, modifiée par la loi 25-11) : ANPDP

Ce que disent les textes :
- **Loi 18-07, art. 12 à 14** (**vérifié**, JORA n° 34 du 10 juin 2018) : tout traitement est soumis à une **déclaration préalable** auprès de l'autorité nationale (ANPDP) ou à son **autorisation**. Le récépissé est remis au plus tard dans les **48 heures** et le traitement peut commencer dès sa réception (art. 13). La déclaration indique notamment les destinataires, « la nature des données dont le transfert vers des pays étrangers est envisagé » et la **durée de conservation** (art. 14).
- **Art. 44** (**vérifié**) : le transfert vers un État étranger n'est possible que « sur autorisation de l'autorité nationale » et si cet État assure « un niveau de protection suffisant ».
- **Art. 45** (**vérifié**) : par dérogation, transfert possible notamment si la personne « a consenti expressément » (1°), si le transfert est nécessaire « à l'exécution d'un contrat entre le responsable du traitement et la personne concernée » (2° d), ou sur autorisation de l'autorité nationale (4°).
- **Loi 25-11 du 24 juillet 2025** (**vérifié**, JORA n° 48 de 2025) : le responsable du traitement désigne un **délégué à la protection des données** et communique ses coordonnées à l'autorité nationale (nouvel art. 41 bis) ; il tient un **registre des activités de traitement**, y compris les destinataires « dans les autres Etats » (art. 41 bis 2) ; il tient, avec le sous-traitant, un **carnet automatisé des opérations** (art. 41 bis 3).
- **Violation de données** : la loi 18-07, art. 43 (**vérifié**), dit que le fournisseur de services avertit « sans délai » l'autorité nationale (et la personne si sa vie privée peut être atteinte). La loi 25-11 ajoute un délai de **5 jours** (art. 45 bis 8), mais dans un nouveau titre V bis qui concerne les traitements à des fins pénales (prévention des infractions, enquêtes, poursuites). **Non vérifié** : ce délai s'applique-t-il à BleDeal ?
- **Site de l'ANPDP** (consulté le 10/10/2026, version arabe) : déclaration des traitements et demandes d'autorisation sur `portail.anpdp.dz` ; plaintes sur `plaintes.anpdp.dz` ; page « procédures de conformité, modèles et guides ». Contenu des formulaires : **non consulté**.

Questions :
9. Qui doit déclarer : BleDeal seul (responsable du traitement), ou aussi chaque boutique pour les données des clients qu'elle reçoit (nom, numéro, commande) ?
10. Une seule **déclaration** pour tous les traitements (comptes, commandes, bons, avis, statistiques) ? Le dépôt sur `portail.anpdp.dz` suffit-il ? Faut-il le récépissé **avant** d'ouvrir le site au public ?
11. **Transferts hors d'Algérie** (7 prestataires, tableau ci-dessus) : faut-il **l'autorisation de l'ANPDP** (art. 44), ou peut-on s'appuyer sur le **consentement exprès** (case non cochée à l'inscription, art. 45, 1°) et sur l'**exécution du contrat** (art. 45, 2° d) ? Pour les **commerçants** aussi ? Pour Anthropic (photos et textes des commerçants) ?
12. Si l'autorisation est nécessaire : délai habituel, pièces à fournir, et peut-on ouvrir le site en attendant ?
13. **Délégué à la protection des données** (loi 25-11, art. 41 bis) : obligatoire pour une petite société ? Le gérant peut-il l'être ? Peut-on le confier à un cabinet extérieur ? Comment communiquer ses coordonnées à l'ANPDP ?
14. Registre (art. 41 bis 2) et carnet automatisé des opérations (art. 41 bis 3) : quelle forme minimale pour BleDeal ? Les journaux de Supabase suffisent-ils ? Les prestataires étrangers (sous-traitants) doivent-ils tenir le leur ?
15. **Violation de données** : quel délai appliquer (« sans délai », art. 43 ; 5 jours, art. 45 bis 8 ?) et à qui écrire ?
16. Les **statistiques de visite** avec empreinte d'adresse IP, gardée 24 heures : est-ce une donnée personnelle ? Faut-il un consentement ?
17. Les **messages publicitaires WhatsApp** (prévus, jamais envoyés à ce jour) : la case séparée prévue suffit-elle (loi 18-05, art. 31 et 32 ; loi 18-07, art. 37, cités dans `README.md`, **non relus pour ce dossier**) ?

### C. Âge minimum

- **Code civil, art. 40** : « La majorité est fixée à dix neuf (19) ans révolus. » (**non vérifié** au Journal officiel : lu dans des copies du Code civil, getkateb.com et la copie publiée par alkarama.org.)
- **Code civil, art. 42**, modifié par la loi 05-10 (JORA n° 44 du 26 juin 2005, p. 17 ; extrait de la page du JORADP lu par la recherche, page entière non ouverte) : l'enfant de moins de **13 ans** est réputé dépourvu de discernement.
- **Loi 18-07, art. 8** (**vérifié**) : le traitement des données d'un **enfant** exige le consentement de son représentant légal (ou l'autorisation du juge). La loi 18-07 ne définit pas l'« enfant » dans les articles lus.

18. Âge minimum pour créer un compte client et réserver : **19 ans** (majorité civile) ou **18 ans** ? Un mineur de 16 à 18 ans peut-il réserver un article avec l'accord d'un parent ? Comment le prouver, sans demander de pièce d'identité ?
19. Quelle définition de l'« enfant » appliquer pour l'art. 8 de la loi 18-07 (moins de 18 ans, selon une autre loi ? **non vérifié**) ?

### D. Cosmétiques et parfums

- **Loi 18-05, art. 3** (**vérifié**) : sont interdits en ligne notamment les jeux de hasard, l'alcool et le tabac, les **produits pharmaceutiques**, les contrefaçons, tout produit interdit par la loi, et « tout bien ou service qui requiert un acte authentique ».
- **Décret exécutif 97-37 du 14 janvier 1997** (JO n° 04 de 1997), modifié par le **décret exécutif 10-114 du 18 avril 2010** (JO n° 26 de 2010) : conditions de fabrication, de conditionnement, d'importation et de commercialisation des produits cosmétiques et d'hygiène corporelle, avec des listes de substances interdites ou limitées (titres et références lus sur commerce.gov.dz ; **contenu non lu**).

20. Les boutiques peuvent-elles mettre des parfums, du maquillage et des soins sur BleDeal ? Où passe la limite avec les produits **pharmaceutiques ou parapharmaceutiques** (art. 3) ?
21. Que doit vérifier BleDeal : rien (le commerçant est responsable), ou des documents (factures d'achat, autorisation d'importation, étiquetage en arabe) ? Que risque BleDeal si une boutique vend une **contrefaçon** de parfum ?

### E. Forme de la société, registre du commerce et NIF

- **Auto-entrepreneur** (loi 22-23 du 18 décembre 2022) : réservé à une personne physique, pour une liste d'activités fixée par décret ; « les fonctions libérales, les professions et les activités réglementées et artisanales » en sont exclues (texte lu sur une copie du JORA, NATLEX). D'après une source secondaire (upgrowth.dz), la liste ne contient que des services, dont des activités « e-commerce » (marketeur, développeur…) : **non vérifié**.
- **Associé non-résident** : d'après des sources secondaires (lentrepreneuralgerien.com, TSA), la loi de finances complémentaire 2020 (art. 49) aurait gardé la règle 51/49 pour l'achat-revente et les secteurs stratégiques : **non vérifié**.

22. Quelle forme pour démarrer : commerçant personne physique, **EURL**, **SARL**, auto-entrepreneur, label « startup » ? Coût, délai, capital minimum, comptabilité obligatoire ?
23. Un **associé qui réside à l'étranger** peut-il détenir des parts ? Jusqu'à quel pourcentage pour cette activité ? Peut-il être gérant ?
24. Démarches et ordre : registre du commerce (CNRC), **NIF**, carte d'immatriculation, banque ou CCP professionnel, domaine « .com.dz », hébergement, déclaration ANPDP. Délai total ?
25. Peut-on garder le nom **BleDeal** (dénomination au CNRC, marque à l'INAPI) ? Faut-il déposer la marque ?

### F. Langue arabe

- **Loi 09-03 du 25 février 2009** (protection du consommateur), **art. 18** : d'après les résumés consultés (faolex.fao.org, commerce.gov.dz), l'étiquetage, le mode d'emploi, les conditions de garantie et toute autre information prévue par la réglementation sont rédigés principalement en **arabe**, et accessoirement dans d'autres langues : **non vérifié** dans le texte.

26. Les **conditions d'utilisation**, les conditions commerçants et la politique de confidentialité doivent-elles exister en **arabe** ? Si oui, quelle version fait foi en cas de désaccord ?
27. Les fiches des articles et les messages WhatsApp (déjà en français et en arabe) suffisent-ils, ou faut-il plus ?
28. Pouvez-vous faire, ou recommander, une **traduction juridique** en arabe des 3 textes ? Coût et délai ?

### G. Durées de conservation

- **Code de commerce, art. 12** : livres et documents comptables conservés **10 ans** (texte de l'ordonnance 75-59 lu sur commerce.gov.dz et WIPO Lex : **non vérifié** au JORA).
- **Loi 07-11 du 25 novembre 2007** (système comptable financier), art. 20 : livres comptables et pièces justificatives conservés **10 ans** après la clôture de l'exercice (copie du JORA n° 74 de 2007 sur mf.gov.dz : **non vérifié** au JORA).
- **Loi 18-07, art. 9, e)** (**vérifié**) : données gardées pas plus longtemps que nécessaire aux finalités.

29. Durées à écrire dans la politique de confidentialité et dans la déclaration ANPDP : compte inactif (`[x]` ans ?), commandes, **relevés de bons et références de paiement** (10 ans ?), no-shows et blocages, statistiques (`[x]` mois ?), avis, acceptations des conditions (preuve du consentement, loi 18-05, art. 33, cité dans `README.md`).
30. Quand un client **ferme son compte**, que peut-on garder (commandes pour la comptabilité, empreinte du numéro pour les règles anti-abus) ?

### H. Bons de réduction et parrainage (pour l'expert-comptable surtout)

Rappel : BleDeal offre des bons (300 DA de parrainage aujourd'hui ; 300, 500 et 150 DA prévus). La boutique les déduit en caisse et **BleDeal lui rembourse** le montant chaque mois, en dehors du site. Le client paie donc moins en espèces, et la boutique est payée du reste par BleDeal.
- **Ventes promotionnelles** : le décret exécutif 06-215 du 18 juin 2006, modifié par le décret exécutif 20-399 du 26 décembre 2020, dit que l'agent économique qui fait des ventes promotionnelles dépose une **déclaration** auprès de la direction de wilaya du commerce et informe la clientèle par affichage (art. 7 et 8, lus sur commerce.gov.dz : **non vérifié** au JORA).

31. **Nature juridique du bon** : réduction de prix accordée par BleDeal, bon d'achat, cadeau ? Le parrainage (300 DA au parrain et au filleul) pose-t-il un problème légal ?
32. Les bons et les campagnes (Aïd, rentrée) sont-ils des « **ventes promotionnelles** » au sens du décret 06-215 ? Qui doit faire la **déclaration** à la direction du commerce d'Oran : BleDeal, chaque boutique, ou personne ?
33. **Chez BleDeal** : comment comptabiliser les remboursements (charge de publicité ou de promotion ?) ? Quelles pièces garder : relevé mensuel, référence CCP/BaridiMob, **reçu ou facture de la boutique** ?
34. **Chez la boutique** : déclare-t-elle la vente au **prix total** (espèces + remboursement BleDeal) ou au montant encaissé ? Doit-elle faire une **facture** à BleDeal ? Avec ou sans **TVA** ? Et si la boutique est au régime de l'IFU (impôt forfaitaire unique) ?
35. **Retenue à la source**, déclaration particulière ou plafond pour des paiements à des commerçants ? Peut-on payer une boutique **en espèces** contre reçu ?
36. Le **budget** (30 000 DA par mois au départ) pose-t-il une question fiscale ou de forme (BleDeal sans revenus au départ) ?
37. L'accord avec les boutiques (`accord-boutiques-bons.md`) : suffit-il en l'état ? Faut-il le faire signer sur papier, ou une acceptation dans l'espace commerçant suffit-elle ?

### I. Contrats et responsabilité

38. Relire les 3 brouillons (`conditions-utilisation.md`, `conditions-commercants.md`, `confidentialite.md`) et l'accord des bons : clauses à corriger, **tribunal compétent**, mentions obligatoires manquantes.
39. Responsabilité de BleDeal si un article est faux, si la boutique refuse de vendre au prix affiché, ou si le client ne vient pas (no-show, blocage au 5e) : nos règles anti-abus (blocage du compte) sont-elles acceptables ?
40. Les **avis** clients sur les boutiques (prévus) : quels risques (diffamation, faux avis) ? Que doit-on garder comme preuve ?

## 3. Documents à apporter

- Ce dossier, imprimé, avec les 4 brouillons de `docs/juridique/` : `conditions-utilisation.md`, `conditions-commercants.md`, `confidentialite.md`, `accord-boutiques-bons.md`.
- Les textes de loi imprimés : loi 18-05 (JORA n° 28 de 2018), loi 18-07 (JORA n° 34 de 2018), loi 25-11 (JORA n° 48 de 2025).
- **Pièce d'identité** du ou des fondateurs ; pour un associé non-résident : passeport, justificatif de résidence à l'étranger.
- Projet de **statuts** (si déjà prêt), nom choisi (BleDeal), adresse prévue du siège (bail ou domiciliation).
- La liste des **prestataires** et de leurs pays (tableau du point 8 de `confidentialite.md`) et, si possible, leurs conditions de traitement des données (Supabase, Vercel, Meta, Twilio, Cloudflare, CARTO, Anthropic).
- Des **captures d'écran** du site : inscription, panier, « Mes commandes » avec le QR code, espace commerçant, page `/parrainage`, relevé de bons (`/admin/remboursements`), un export CSV `bledeal-bons-AAAA-MM.csv` sans données réelles.
- Un **exemple de relevé** mensuel de bons et un exemple de reçu de paiement CCP ou BaridiMob.
- Le budget prévu (bons, hébergement, WhatsApp) et le modèle de revenus envisagé.
- La liste des boutiques partenaires prévues à Oran (nombre, type : mode, parfumerie, maquillage) et leur forme (RC, carte d'artisan).

## 4. Sources (consultées le 10/10/2026)

**Textes officiels lus (vérifié)**
- Loi 18-05 du 10 mai 2018 relative au commerce électronique, JORA n° 28 du 16 mai 2018 : https://www.joradp.dz/FTP/JO-FRANCAIS/2018/F2018028.pdf (art. 3, 6, 8, 9, 11, 20, 25, 26, 30 lus).
- Loi 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel, JORA n° 34 du 10 juin 2018 : https://www.joradp.dz/FTP/JO-FRANCAIS/2018/F2018034.pdf (art. 7, 8, 9, 12, 13, 14, 43, 44, 45 lus).
- Loi 25-11 du 24 juillet 2025 modifiant et complétant la loi 18-07, JORA n° 48 de 2025 : https://www.joradp.dz/FTP/JO-FRANCAIS/2025/F2025048.pdf (art. 2 à 8, dont les nouveaux art. 41 bis à 41 bis 3 et 45 bis 8, lus).
- Loi 05-10 du 20 juin 2005 modifiant le Code civil (art. 42), JORA n° 44 de 2005, p. 17 : https://www.joradp.dz/jo2000/2005/044/FP17.pdf (extrait lu dans les résultats de recherche).
- ANPDP : https://anpdp.dz (page d'accueil en arabe ; liens vers `portail.anpdp.dz`, déclaration et autorisation, et `plaintes.anpdp.dz`).

**Sources secondaires (non vérifié)**
- Code civil, art. 40 (majorité à 19 ans) : https://getkateb.com/corpus/code-civil et https://www.alkarama.org/sites/default/files/2016-11/ALG_Codecivil2007_FR.pdf.
- Code de commerce, art. 12 : https://www.commerce.gov.dz/media/reglementation/source/concurrence/code-commerce/fr/livre1ccfr.pdf et https://www.wipo.int/wipolex/en/legislation/details/14773.
- Loi 07-11 (système comptable financier), art. 20 : https://www.mf.gov.dz/pdf/texte/autre_textes/upl-e3c3c2013fefd5dab13560df1b8b5bbe.pdf.
- Décrets exécutifs 97-37 et 10-114 (cosmétiques) : https://commerce.gov.dz/fr/reglementation/decret-executif-n-deg-97-37 et https://commerce.gov.dz/fr/reglementation/decret-executif-n-deg-10-114.
- Décret exécutif 06-215, modifié par le 20-399 (soldes et ventes promotionnelles) : https://www.commerce.gov.dz/fr/les-ventes-promotionnelles et https://commerce.gov.dz/fr/telecharger/reglementation/929/article.
- Loi 09-03 (protection du consommateur), art. 18 : https://www.commerce.gov.dz/media/bibliotheque/source/a-la-une/Loi09-03_fr.pdf (résumé seulement).
- Loi 22-23 (auto-entrepreneur) : https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/114274/DZA-114274.pdf ; liste des activités : https://www.upgrowth.dz/datasets/anae-2026.
- Règle 51/49 après la loi de finances complémentaire 2020 : https://lentrepreneuralgerien.com/images/pdf/informations-generales/Communique_-LFC_2020.pdf et articles de TSA.

**Pas trouvé** : texte réglementaire fixant les modalités de l'art. 25 de la loi 18-05 (registres transmis au CNRC) ; procédure exacte de dépôt du nom de domaine au CNRC ; régime fiscal des bons remboursés aux boutiques ; contenu des formulaires de l'ANPDP.
