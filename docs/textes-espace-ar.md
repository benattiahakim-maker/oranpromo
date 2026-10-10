# Espace commerçant en arabe : textes FR → AR (à valider par le propriétaire)

Règles (comme US-23) : arabe simple avec des mots de darja d’Oran ; le commerçant est interpellé au **masculin générique** ;
en français, on garde le **« vous »** (textes français inchangés). Nombres en chiffres 0-9 ; prix avec `Prix`, numéros avec `Numero`.
Pas traduits : le texte juridique entier des conditions commerçants (avis « texte officiel en français » de #146 en arabe),
l’affiche imprimée pour les clients (`/espace/affiche`), l’administration et la page « Confirmer » (décision de BOLOSS),
ce que saisit la boutique (titres, descriptions). Noms des campagnes : en arabe, le nom arabe saisi par l'admin dans
« Nouvelle campagne » (`programmes_bons.nom_ar`), au plafond comme dans le relevé ; le nom français seulement s'il manque.

**Ajouts du 10/10 après-midi** (BOLOSS) : bloc « Bons à rembourser » (`espace.bons`, 23 textes) et résumé des engagements
des conditions commerçants (`espace.conditions.resume1` à `resume5`, plus `provisoire`) : 29 textes marqués **(nouveau)** ;
`espace.conditions.francais` **(modifié)** (le résumé est maintenant en arabe, le texte officiel reste en français) ;
`espace.accueil.bonsEnFrancais` retiré (note provisoire « bloc en français »).

Listes déjà traduites et réutilisées : catégories, genres (`textes.listes`), statuts et motifs d’annulation des commandes
(`textes.commandes`), critères et motifs de signalement des avis (`textes.avis`).

## Textes de l’interface (`lib/textes/fr.ts` et `ar.ts`, section `espace`)

#### `espace.nav`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Espace commerçant | فضاء التاجر |
| `mesArticles` | Mes articles | السلع نتاعي |
| `commandes` | Commandes | الطلبات |
| `avis` | Avis | الآراء |
| `avisSansReponse` | Avis, {n} sans réponse | الآراء، {n} بلا رد |
| `ajouter` | Ajouter | زيد |
| `statistiques` | Statistiques | الإحصائيات |
| `deconnecter` | Se déconnecter | اخرج |

#### `espace.commun`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `monEspace` | Mon espace | الفضاء نتاعي |
| `mesArticles` | Mes articles | السلع نتاعي |
| `retourMesArticles` | ← Mes articles | → السلع نتاعي |
| `retourEspace` | Retour à mon espace | رجوع للفضاء نتاعي |
| `retourArticles` | Retour à mes articles | رجوع للسلع نتاعي |
| `sansBoutique` | Votre compte n'est rattaché à aucune boutique | الحساب نتاعك ماشي مربوط بحتى حانوت |
| `profilImpossible` | Impossible de charger votre profil. Réessayez. | ما قدرناش نحمّلو الحساب نتاعك. عاود جرّب. |
| `enregistrement` | Enregistrement… | راهو يتسجّل… |
| `retour` | Retour | رجوع |
| `voir` | Voir | شوف |
| `fermer` | Fermer | سكّر |
| `annuler` | Annuler | الغي |
| `scanner` | Scanner | سكاني |
| `copierLien` | Copier le lien | انسخ الرابط |
| `lienCopie` | Lien copié. | الرابط تنسخ. |

#### `espace.accueil`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `ajouterArticle` | + Ajouter un article | + زيد سلعة |
| `articlesImpossible` | Impossible de charger vos articles. Réessayez. | ما قدرناش نحمّلو السلع نتاعك. عاود جرّب. |
| `deconnexionImpossible` | Impossible de vous déconnecter. Réessayez. | ما قدرناش نخرّجوك. عاود جرّب. |
| `mesStatistiques` | Mes statistiques | الإحصائيات نتاعي |
| `avisClients` | Avis clients | آراء الزبائن |
| `avisClientsLibelle` | Avis clients : {resume} | آراء الزبائن: {resume} |
| `mesCommandes` | Mes commandes | الطلبات نتاعي |

#### `espace.resumeAvis`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `aucun` | Pas encore d’avis | مازال ما كاين حتى راي |
| `nombre` | {n} avis | {n} راي |
| `sansReponse` | {n} sans réponse | {n} بلا رد |

#### `espace.abonnes`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Clients qui suivent la boutique | الزبائن اللي يتبّعو الحانوت |
| `aucun` | Aucun client ne suit encore votre boutique. | مازال حتى زبون ما يتبّع الحانوت نتاعك. |
| `un` | 1 client suit votre boutique | زبون واحد يتبّع الحانوت نتاعك |
| `plusieurs` | {n} clients suivent votre boutique | {n} زبائن يتبّعو الحانوت نتاعك |
| `semaine` | {base} · +{n} cette semaine | {base} · +{n} هاد السيمانة |
| `inscrit` | {base} · dont {n} inscrit en boutique | {base} · منهم {n} تسجّل في الحانوت |
| `inscrits` | {base} · dont {n} inscrits en boutique | {base} · منهم {n} تسجّلو في الحانوت |
| `bonsInscription` | Bons de bienvenue des inscrits ce mois : {n}{plafond}. | بونات مرحبا تاع اللي تسجّلو هاد الشهر: {n}{plafond}. |
| `part` |  Votre part : {montant} par bon utilisé chez vous (déduite du remboursement). |  الحصة نتاعك: {montant} على كل بون يتخدم عندك (تتنقص من الخلاص). |
| `affiche` | Affiche avec QR code : inscrivez vos clients en caisse | أفيش بـ QR code: سجّل الزبائن نتاعك في الكاشة |

#### `espace.articles`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `aucun` | Vous n’avez pas encore d’article. | مازال ما عندك حتى سلعة. |
| `statutImpossible` | Impossible de changer le statut. Réessayez. | ما قدرناش نبدّلو الحالة. عاود جرّب. |
| `modifier` | Modifier {titre} | بدّل {titre} |
| `sansPhoto` | Sans photo | بلا صورة |
| `promo` | PROMO | تخفيض |
| `statutDe` | Statut de {titre} | حالة {titre} |
| `statuts.disponible` | Disponible | كاينة |
| `statuts.reserve` | Réservé | محجوزة |
| `statuts.vendu` | Vendu | تباعت |
| `statuts.masque` | Masqué | مخبّية |
| `masqueModeration` | Article masqué par la modération : contactez l’administrateur pour le rendre visible. | السلعة خبّاتها المراقبة: اتصل بالإدارة باش ترجع تبان. |
| `stock` | Stock | السطوك |
| `stockDe` | Stock de {titre} | سطوك {titre} |
| `moins` | Taille {taille} : une pièce de moins | مقاس {taille}: نقّص وحدة |
| `plus` | Taille {taille} : une pièce de plus | مقاس {taille}: زيد وحدة |
| `stockImpossible` | Impossible d’enregistrer le stock. Réessayez. | ما قدرناش نسجّلو السطوك. عاود جرّب. |
| `epuise` | Épuisé | ما بقاش |
| `piece` | 1 pièce | حبة وحدة |
| `pieces` | {n} pièces | {n} حبات |

#### `espace.formulaire`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Titre | العنوان |
| `titreAjout` | TITRE * | العنوان * |
| `categorie` | Catégorie | النوع |
| `categorieAjout` | CATÉGORIE * | النوع * |
| `choisir` | Choisir | اختار |
| `genre` | Genre | لمن |
| `genreAjout` | GENRE | لمن |
| `genreFacultatif` | Genre (facultatif) | لمن (إلا حبيت) |
| `genreFacultatifAjout` | GENRE (FACULTATIF) | لمن (إلا حبيت) |
| `nonPrecise` | Non précisé | ماشي محدد |
| `description` | Description (facultative) | الوصف (إلا حبيت) |
| `descriptionAjout` | DESCRIPTION (FACULTATIVE) | الوصف (إلا حبيت) |
| `prix` | Prix en DA | السومة بالدينار |
| `prixAjout` | PRIX EN DA * | السومة بالدينار * |
| `publier` | PUBLIER L’ARTICLE | انشر السلعة |
| `enregistrer` | Enregistrer | سجّل |
| `enregistre` | Article enregistré. | السلعة تسجّلت. |
| `enregistrementImpossible` | Impossible d’enregistrer l’article. Réessayez. | ما قدرناش نسجّلو السلعة. عاود جرّب. |
| `proposeIA` | Proposé par l’IA | اقترحها الذكاء الاصطناعي |
| `iaPrepare` | L’IA prépare la fiche… | الذكاء الاصطناعي راهو يوجّد الفيشة… |
| `brouillonRestaure` | Brouillon restauré | رجّعنا المسودة |
| `effacer` | Effacer | امسح |
| `brouillonPhotos` | Les photos ne sont pas sauvegardées dans le brouillon. Choisissez-les à nouveau. | التصاور ما يتحفظوش في المسودة. اختارهم من جديد. |
| `taillesReinitialisees` | Tailles réinitialisées pour cette catégorie | المقاسات رجعو من الأول لهاد النوع |
| `couleur` | Couleur (facultative) | اللون (إلا حبيت) |
| `contenances` | Contenances disponibles * | الأحجام اللي كاينين * |
| `tailles` | Tailles disponibles * | المقاسات اللي كاينين * |
| `unique` | Unique | واحد |
| `tailleUnique` | Taille unique | مقاس واحد |
| `categorieDabord` | Choisissez d’abord une catégorie. | اختار النوع الأول. |
| `couleurs.Noir` | Noir | كحل |
| `couleurs.Blanc` | Blanc | بيض |
| `couleurs.Gris` | Gris | رمادي |
| `couleurs.Beige` | Beige | بيج |
| `couleurs.Marron` | Marron | قهوي |
| `couleurs.Bleu marine` | Bleu marine | زرق غامق |
| `couleurs.Bleu` | Bleu | زرق |
| `couleurs.Vert` | Vert | خضر |
| `couleurs.Kaki` | Kaki | كاكي |
| `couleurs.Rouge` | Rouge | حمر |
| `couleurs.Bordeaux` | Bordeaux | بوردو |
| `couleurs.Rose` | Rose | روز |
| `couleurs.Jaune` | Jaune | صفر |
| `couleurs.Orange` | Orange | ليموني |
| `couleurs.Violet` | Violet | موف |
| `couleurs.Multicolore` | Multicolore | بزاف الألوان |

#### `espace.photos`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `legende` | Photos de l’article | تصاور السلعة |
| `titre` | Photos · 1 à 5 * | التصاور · من 1 حتى 5 * |
| `photo` | Photo {n} | صورة {n} |
| `retirer` | Retirer la photo {n} | نحّي الصورة {n} |
| `galerie` | Choisir dans la galerie | اختار من الغاليري |
| `prendre` | Prendre une photo | صوّر |
| `ajouter` | + Ajouter des photos | + زيد تصاور |

#### `espace.descriptionArabe`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Description en arabe | الوصف بالعربية |
| `traduction` | Traduction en cours… | راهي تترجم… |
| `generer` | Générer en arabe | ترجم للعربية |
| `texte` | Texte arabe (facultatif) | النص بالعربية (إلا حبيت) |
| `saisieChangee` | Votre saisie a changé pendant la traduction. Elle a été conservée. | الكتابة نتاعك تبدّلت وقت الترجمة. خلّيناها كيما هي. |

#### `espace.nouvel`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Nouvel article | سلعة جديدة |
| `titreMajuscules` | NOUVEL ARTICLE | سلعة جديدة |
| `enLigne` | Article en ligne | السلعة راهي في الموقع |
| `copieImpossible` | La copie automatique est indisponible. Sélectionnez le lien pour le copier. | النسخ الأوتوماتيك ما يخدمش. حدّد الرابط وانسخو. |
| `autre` | Ajouter un autre article | زيد سلعة أخرى |
| `profilImpossible` | Impossible de charger votre profil. Réessayez dans quelques instants. | ما قدرناش نحمّلو الحساب نتاعك. عاود جرّب من بعد شوية. |

#### `espace.modifier`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Modifier l’article | بدّل السلعة |
| `suppression` | Suppression de l’article | حذف السلعة |
| `confirmer` | Supprimer définitivement cet article et ses photos ? | تحب تحذف هاد السلعة وتصاورها نهائيا؟ |
| `oui` | Oui, supprimer l’article | إيه، احذف السلعة |
| `supprimer` | Supprimer l’article | احذف السلعة |
| `suppressionImpossible` | Impossible de supprimer l’article. Réessayez. | ما قدرناش نحذفو السلعة. عاود جرّب. |
| `articleImpossible` | Impossible de charger cet article. Réessayez. | ما قدرناش نحمّلو هاد السلعة. عاود جرّب. |

#### `espace.promo`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Promo | التخفيض |
| `prixNormal` | Prix normal enregistré : | السومة العادية المسجّلة: |
| `prixPromo` | Prix promo en DA | سومة التخفيض بالدينار |
| `pourcentage` | Réduction en pourcentage | التخفيض بالمية |
| `dateFin` | Date de fin | تاريخ النهاية |
| `badge` | Badge | العلامة |
| `parDefaut` | (par défaut) | (العادي) |
| `flash` | Promo flash | تخفيض فلاش |
| `enregistrer` | Enregistrer la promo | سجّل التخفيض |
| `arreter` | Arrêter la promo | وقّف التخفيض |
| `enregistree` | Promo enregistrée. | التخفيض تسجّل. |
| `arretee` | Promo arrêtée. | التخفيض حبس. |
| `impossible` | Impossible de modifier la promo. Réessayez. | ما قدرناش نبدّلو التخفيض. عاود جرّب. |
| `pourcentageInvalide` | Saisissez un pourcentage supérieur à 0 et inférieur à 100. | اكتب نسبة كثر من 0 وأقل من 100. |

#### `espace.commandes`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Commandes reçues | الطلبات اللي جاوك |
| `recherche` | N° ou prénom | الرقم ولا الاسم |
| `effacerRecherche` | Effacer la recherche | امسح البحث |
| `scannerLibelle` | Scanner un QR code client | سكاني QR code تاع زبون |
| `resultat` | {n} résultat pour « {q} » · toutes les étapes | {n} نتيجة لـ « {q} » · كل المراحل |
| `resultats` | {n} résultats pour « {q} » · toutes les étapes | {n} نتائج لـ « {q} » · كل المراحل |
| `etapesLibelle` | Étapes | المراحل |
| `impossible` | Impossible de charger les commandes. Réessayez. | ما قدرناش نحمّلو الطلبات. عاود جرّب. |
| `preparationUne` | Liste de préparation ({n} commande) | ليستة التوجاد ({n} طلب) |
| `preparationPlusieurs` | Liste de préparation ({n} commandes) | ليستة التوجاد ({n} طلبات) |
| `remisePretes` | Remise : scannez le QR code du client (bouton « Scanner » en haut), ou ouvrez la commande pour « Remis sans QR code ». | التسليم: سكاني QR code تاع الزبون (الزر « سكاني » الفوق)، ولا حل الطلب واختار « سلّمت بلا QR code ». |
| `seules` | Seules les {n} premières sont affichées : cherchez par n° ou prénom. | غير الـ {n} اللولين باينين: قلّب بالرقم ولا الاسم. |
| `rienTrouve` | Rien trouvé ? Tapez le numéro de commande (ex. 131) ou le début du prénom. | ما لقيت والو؟ اكتب رقم الطلب (مثلا 131) ولا بداية الاسم. |
| `etapes.a_confirmer.libelle` | À confirmer | باش تأكّد |
| `etapes.a_confirmer.vide` | Aucune commande à confirmer. | ما كاين حتى طلب باش تأكّدو. |
| `etapes.a_confirmer.heure` | Reçue | وصلت |
| `etapes.a_preparer.libelle` | À préparer | باش توجّد |
| `etapes.a_preparer.vide` | Aucune commande à préparer. | ما كاين حتى طلب باش توجّدو. |
| `etapes.a_preparer.heure` | Confirmée | تأكّدت |
| `etapes.pretes.libelle` | Prêtes | واجدين |
| `etapes.pretes.vide` | Aucune commande prête. | ما كاين حتى طلب واجد. |
| `etapes.pretes.heure` | Prête | واجدة |
| `etapes.terminees.libelle` | Terminées | كملو |
| `etapes.terminees.vide` | Aucune commande terminée ces 7 derniers jours. | ما كاين حتى طلب كمل في 7 أيام اللي فاتو. |
| `etapes.terminees.heure` | Terminée | كملت |

#### `espace.miseAJour`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `aJour` | À jour · {heure} | محدّث · {heure} |
| `perdue` | Connexion perdue, nouvel essai… · dernière mise à jour à {heure} | الأنترنت راحت، راهو يعاود… · آخر تحديث على {heure} |
| `actualiser` | Actualiser | حدّث |
| `sonActive` | Son activé | الصوت خدّام |
| `couper` | Couper | قطع |
| `activerSon` | Activer le son | شعّل الصوت |
| `nouvelles` | {n} nouvelles commandes · la dernière : n° {numero} | {n} طلبات جداد · اللخرانية: رقم {numero} |
| `nouvelle` | Nouvelle commande n° {numero} | طلب جديد رقم {numero} |

#### `espace.tableau`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `aucune` | Aucune commande ne correspond. | ما كاين حتى طلب كيما هكا. |
| `groupeImpossible` | Impossible de modifier les commandes. Vérifiez votre connexion. | ما قدرناش نبدّلو الطلبات. شوف الأنترنت ديالك. |
| `ligneImpossible` | Impossible de modifier la commande. Vérifiez votre connexion. | ما قدرناش نبدّلو الطلب. شوف الأنترنت ديالك. |
| `confirmerLes` | Confirmer les {n} | أكّد الـ {n} |
| `confirmerUne` | Confirmer la commande | أكّد الطلب |
| `marquerPrete` | Marquer prête ({n}) | حطّها واجدة ({n}) |
| `marquerPretes` | Marquer prêtes ({n}) | حطّهم واجدين ({n}) |
| `toutCocher` | Tout cocher ({n}) | علّم الكل ({n}) |
| `urgentes` | Les plus urgentes en haut | اللي مزروبين الفوق |
| `colNumero` | N° | رقم |
| `colPrenom` | Prénom | الاسم |
| `colArticles` | Articles | السلع |
| `colAEncaisser` | À encaisser | باش تقبض |
| `colEtape` | Étape | المرحلة |
| `colEcheance` | Échéance | الوقت |
| `colBon` | Bon | بون |
| `cochee` | {n} commande cochée | {n} طلب معلّم |
| `cochees` | {n} commandes cochées | {n} طلبات معلّمين |
| `decocher` | Décocher | نحّي العلامات |
| `auPlus` | {n} au plus à la fois | {n} على الأكثر في خطرة |
| `cocher` | Cocher la commande n° {n} | علّم الطلب رقم {n} |
| `numeroCourt` | N° {n} | رقم {n} |
| `nouveau` | Nouveau | جديد |
| `article` | {n} article | {n} سلعة |
| `articles` | {n} articles | {n} سلع |
| `heureA` | {etape} à {heure} | {etape} على {heure} |
| `bon` | Bon {n} | بون {n} |
| `corrigerStock` | Corriger le stock dans Mes articles | صلّح السطوك في السلع نتاعي |
| `hier` | hier {heure} | البارح {heure} |
| `heure` | {h} h {m} | {h}:{m} |
| `moinsUneMinute` | moins d’1 min | أقل من دقيقة |
| `minutes` | {m} min | {m} دق |
| `heures` | {h} h | {h} سا |
| `heuresMinutes` | {h} h {m} | {h} سا {m} |
| `attend` | attend depuis {duree} | يستنّى من {duree} |
| `confirmeeIlYa` | confirmée il y a {duree} | تأكّدت هادي {duree} |
| `prete` | prête | واجدة |
| `expiree` | expirée, en attente | فات وقتها، تستنّى |
| `expireDans` | expire dans {duree} | يفوت وقتها في {duree} |
| `aucuneModifiee` | Aucune commande modifiée. | حتى طلب ما تبدّل. |
| `confirmees` | {n} commande confirmée. | {n} طلب تأكّد. |
| `confirmeesPlusieurs` | {n} commandes confirmées. | {n} طلبات تأكّدو. |
| `pretesUne` | {n} commande marquée prête. | {n} طلب ولّا واجد. |
| `pretesPlusieurs` | {n} commandes marquées prêtes. | {n} طلبات ولّاو واجدين. |
| `dejaConfirmee` | N° {n} : déjà confirmée. | رقم {n}: راهو مأكّد من قبل. |
| `dejaPrete` | N° {n} : déjà prête. | رقم {n}: راهو واجد من قبل. |
| `nonConfirmee` | N° {n} non confirmée : {message} | رقم {n} ما تأكّدش: {message} |
| `nonPrete` | N° {n} non marquée prête : {message} | رقم {n} ما ولّاش واجد: {message} |

#### `espace.carte`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `aucune` | Aucune commande ici pour le moment. | ما كاين حتى طلب هنا دابا. |
| `choisirMotif` | Choisissez le motif de l’annulation. | اختار علاش راك تلغي. |
| `signalerImpossible` | Impossible de signaler ce client. Vérifiez votre connexion. | ما قدرناش نبلّغو على هاد الزبون. شوف الأنترنت ديالك. |
| `commande` | Commande n° {n} | الطلب رقم {n} |
| `aRecuperer` | À récupérer jusqu’au {date} | يتدّى حتى {date} |
| `whatsapp` | WhatsApp | واتساب |
| `total` | Total | المجموع |
| `piece` | {n} pièce | {n} حبة |
| `pieces` | {n} pièces | {n} حبات |
| `aEncaisser` | à encaisser | باش تقبض |
| `noteClient` | Note du client : « {note} » | كلمة الزبون: « {note} » |
| `motif` | Motif : {motif} | السبب: {motif} |
| `pasVenuSignale` | Client pas venu · signalé le {date} | الزبون ما جاش · تبلّغ نهار {date} |
| `annuleParBleDeal` |  (annulé par BleDeal) |  (BleDeal لغاه) |
| `remiseScan` | Remise : scannez le QR code du client. | التسليم: سكاني QR code تاع الزبون. |
| `sansQrQuestion` | Le client n’a ni QR code ni code ? Remettez la commande seulement si vous le reconnaissez. | الزبون ما عندو لا QR code لا كود؟ سلّمو الطلب غير إلا عرفتو. |
| `sansQrBon` | Sans QR code, le bon ne s’applique pas : encaissez {montant}. Le bon reste au client. | بلا QR code، البون ما يتحسبش: اقبض {montant}. البون يبقى للزبون. |
| `confirmerRemise` | Confirmer la remise | أكّد التسليم |
| `remisSansQr` | Remis sans QR code | سلّمت بلا QR code |
| `motifAnnulation` | Motif de l’annulation | سبب الإلغاء |
| `messageClient` | Message au client (facultatif) | كلمة للزبون (إلا حبيت) |
| `annulerCommande` | Annuler la commande | الغي الطلب |
| `pasVenuQuestion` | Le client n’est pas venu chercher sa commande ? Il recevra un avertissement sur WhatsApp ; au 5e oubli, son compte est bloqué. | الزبون ما جاش يدّي الطلب؟ يجيه تنبيه في الواتساب؛ في المرة الخامسة يتبلوكا الحساب نتاعو. |
| `confirmerPasVenu` | Confirmer : pas venu | أكّد: ما جاش |
| `clientPasVenu` | Client pas venu | الزبون ما جاش |
| `actions.confirmee` | Confirmer | أكّد |
| `actions.prete` | Prête | واجدة |
| `actions.recuperee` | Récupérée | تدّات |

#### `espace.preparation`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Liste de préparation | ليستة التوجاد |
| `retour` | ← Commandes | → الطلبات |
| `confirmee` | {n} commande confirmée | {n} طلب مأكّد |
| `confirmees` | {n} commandes confirmées | {n} طلبات مأكّدين |
| `piece` | {n} pièce | {n} حبة |
| `pieces` | {n} pièces | {n} حبات |
| `rien` | Rien à préparer pour le moment. | ما كاين والو باش توجّد دابا. |
| `parCommande` | Par commande | حسب الطلب |
| `uneFois` | Une fois préparées : cochez-les dans « À préparer » puis « Marquer prêtes ». | كي توجّدهم: علّمهم في « باش توجّد » ومن بعد « حطّهم واجدين ». |
| `imprimer` | Imprimer | اطبع |
| `dateLongue` | {jour} {date} à {heure} | {jour} {date} على {heure} |

#### `espace.retrait`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Retrait | التسليم |
| `titrePage` | Retrait d’une commande | تسليم طلب |
| `scannerAutre` | Scanner une autre commande | سكاني طلب آخر |
| `voirCommandes` | Voir les commandes | شوف الطلبات |
| `remise` | Commande remise | الطلب تسلّم |
| `remiseTexte` | N° {n} · {montant} · Elle passe en « Récupérée ». Le stock était déjà à jour. | رقم {n} · {montant} · ولّا « تدّات ». السطوك كان محدّث من قبل. |
| `bonRembourse` | {bon} de {montant} : BleDeal vous le rembourse ({releve}). | {bon} تاع {montant}: BleDeal يخلّصهولك ({releve}). |
| `trouvee` | Commande trouvée · {mode} | لقينا الطلب · {mode} |
| `parCode` | par code | بالكود |
| `parQr` | par QR code | بالـ QR code |
| `prete` | Prête · jusqu’au {date} | واجدة · حتى {date} |
| `articles` | Articles | السلع |
| `sousTotal` | Sous-total | المجموع قبل البون |
| `bonBleDeal` | {bon} BleDeal | {bon} BleDeal |
| `aEncaisser` | À encaisser en espèces | تقبض كاش |
| `rembourses` | Ces {montant} vous sont remboursés par BleDeal ({releve}). | هادو {montant} يخلّصهملك BleDeal ({releve}). |
| `parCodeBon` | Par code, le bon ne s’applique pas : encaissez {montant}. Le bon reste au client. | بالكود، البون ما يتحسبش: اقبض {montant}. البون يبقى للزبون. |
| `parCodeRemise` | Remise par code : ni bon parrainage ni parrainage BleDeal. Scannez plutôt le QR code du client. | التسليم بالكود: لا بون العرضة لا العرضة تاع BleDeal. سكاني خير QR code تاع الزبون. |
| `verifier` | Vérifiez les articles avec le client avant de remettre. Un proche peut venir à sa place : c’est normal. | شوف السلع مع الزبون قبل ما تسلّم. واحد من عايلتو ولا صاحبو يقدر يجي في بلاصتو: عادي. |
| `remis` | Remis au client | تسلّم للزبون |
| `impossible` | Impossible de remettre la commande. Vérifiez votre connexion. | ما قدرناش نسلّمو الطلب. شوف الأنترنت ديالك. |
| `releve` | relevé de {mois} | كشف {mois} |
| `releveVoyelle` | relevé d’{mois} | كشف {mois} |

#### `espace.scanner`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Scanner le QR code du client | سكاني QR code تاع الزبون |
| `titrePage` | Scanner un QR code client | سكاني QR code تاع زبون |
| `placez` | Placez le QR code du client dans le cadre. | حط QR code تاع الزبون وسط الكادر. |
| `camera` | Caméra | الكاميرا |
| `ouverture` | Ouverture de la caméra… | راهي تتحل الكاميرا… |
| `navigateur` | Dans WhatsApp ou Instagram, ouvrez votre espace dans Chrome ou Safari. | في الواتساب ولا الإنستغرام، حل الفضاء نتاعك في Chrome ولا Safari. |
| `reessayer` | Réessayer la caméra | عاود جرّب الكاميرا |
| `lampe` | Lampe | الضو |
| `codeLibelle` | La caméra ne marche pas ? Tapez le code à 6 chiffres | الكاميرا ما خدمتش؟ اكتب الكود تاع 6 أرقام |
| `voir` | Voir la commande | شوف الطلب |
| `retourCommandes` | Retour aux commandes | رجوع للطلبات |
| `tapez` | Tapez les 6 chiffres du code. | اكتب الأرقام الستة تاع الكود. |
| `lectureImpossible` | Impossible de lire cette commande. Vérifiez votre connexion. | ما قدرناش نقراو هاد الطلب. شوف الأنترنت ديالك. |

#### `espace.avis`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Avis | الآراء |
| `seuil` | La note s’affiche pour les clients à partir de 3 avis. | النقطة تبان للزبائن من 3 آراء وفوق. |
| `etoiles` | {n} étoiles sur 5 | {n} نجوم من 5 |
| `votreReponse` | Votre réponse : {reponse} | الرد نتاعك: {reponse} |
| `masquee` | Masquée par la modération : les clients ne la voient plus. | خبّاتها المراقبة: الزبائن ما بقاوش يشوفوها. |
| `aucun` | Pas encore d’avis. Les clients peuvent noter votre boutique après un retrait avec leur QR code. | مازال ما كاين حتى راي. الزبائن يقدرو يعطيو نقطة للحانوت نتاعك من بعد ما يدّيو بالـ QR code نتاعهم. |
| `pasSupprimer` | Vous ne pouvez pas supprimer un avis. Un avis faux ou insultant : « Signaler ». | ما تقدرش تحذف راي. راي كذاب ولا فيه سبّان: « بلّغ ». |
| `impossible` | Impossible de charger vos avis. Réessayez. | ما قدرناش نحمّلو الآراء نتاعك. عاود جرّب. |
| `reponseVide` | Écrivez votre réponse. | اكتب الرد نتاعك. |
| `reponseTrop` | La réponse doit contenir {n} caractères au plus. | الرد ما يفوتش {n} حرف. |
| `publierImpossible` | Impossible de publier la réponse. Réessayez. | ما قدرناش ننشرو الرد. عاود جرّب. |
| `reponseLibelle` | Votre réponse publique (une seule fois) | الرد نتاعك قدام الناس (مرة وحدة برك) |
| `publication` | Publication… | راهو يتنشر… |
| `publier` | Publier la réponse | انشر الرد |

#### `espace.statistiques`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Mes statistiques | الإحصائيات نتاعي |
| `periode` | Période des statistiques | مدة الإحصائيات |
| `jours` | {n} jours | {n} يوم |
| `sur` | Sur les {n} derniers jours. | في {n} يوم اللي فاتو. |
| `vuesVitrine` | Vues de la vitrine | شحال من واحد شاف الحانوت |
| `vuesArticles` | Vues des articles | شحال من مرة تشافو السلع |
| `clics` | Clics « Réserver » | الضغطات على « احجز » |
| `top` | Les 5 articles les plus vus | الـ 5 سلع اللي تشافو كثر |
| `vuesClics` | {vues} vues · {clics} clics « Réserver » | {vues} مشاهدة · {clics} ضغطة على « احجز » |
| `aucune` | Aucune vue d’article sur cette période. | حتى سلعة ما تشافت في هاد المدة. |
| `impossible` | Impossible de charger vos statistiques. Réessayez. | ما قدرناش نحمّلو الإحصائيات نتاعك. عاود جرّب. |
| `indisponible` | Article indisponible | السلعة ما بقاتش |

#### `espace.position`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Position sur la carte | البلاصة في الخريطة |
| `statuts.en_attente` | Boutique en attente | الحانوت يستنّى |
| `statuts.validee` | Boutique validée | الحانوت مقبول |
| `statuts.suspendue` | Boutique suspendue | الحانوت موقّف |
| `ville` | Ville : {ville} | المدينة: {ville} |
| `regler` | Réglez-la avant la validation : ensuite, seul BleDeal pourra la changer. | صلّحها قبل ما يتقبل الحانوت: من بعد، غير BleDeal يقدر يبدّلها. |
| `enregistrer` | Enregistrer la position | سجّل البلاصة |
| `carte` | Carte de la position de la boutique | خريطة بلاصة الحانوت |
| `aucune` | Votre boutique n’a pas encore de position sur la carte. | الحانوت نتاعك مازال ما عندو حتى بلاصة في الخريطة. |
| `impossible` | Impossible d’enregistrer la position. Réessayez. | ما قدرناش نسجّلو البلاصة. عاود جرّب. |
| `retiree` | Position retirée. | البلاصة تنحّات. |
| `enregistree` | Position enregistrée. | البلاصة تسجّلت. |
| `contacter` | Pour déplacer votre boutique sur la carte, contactez BleDeal. | باش تبدّل بلاصة الحانوت في الخريطة، اتصل بـ BleDeal. |
| `recherche` | Recherche de la position… (20 s au plus) | راهو يقلّب على البلاصة… (20 ثانية على الأكثر) |
| `lue` | Coordonnées lues dans le lien : {position}. Vérifiez l’épingle sur la carte. | الإحداثيات اللي في الرابط: {position}. شوف الدبوس في الخريطة. |
| `facultative` | Facultative, mais sans position la boutique n’a pas d’épingle sur la carte. | إلا حبيت، بصح بلا بلاصة الحانوت ما يبانش في الخريطة. |
| `jeSuis` | Je suis dans la boutique : utiliser ma position | راني في الحانوت: خود البلاصة نتاعي |
| `deplacez` | Déplacez l’épingle du doigt pour la mettre sur l’entrée de la boutique. | حرّك الدبوس بصبعك وحطّو على باب الحانوت. |
| `touchez` | Touchez la carte pour placer l’épingle. | اضغط على الخريطة باش تحط الدبوس. |
| `retirer` | Retirer la position | نحّي البلاصة |
| `collerLien` | Coller un lien Google Maps | حط رابط Google Maps |
| `aideLien` | Dans Google Maps : Partager › Copier le lien, puis ouvrez-le et copiez l’adresse complète (avec « @35,… »). Le lien n’est jamais ouvert par BleDeal. | في Google Maps: Partager › Copier le lien، ومن بعد حلّو وانسخ العنوان كامل (فيه « @35,… »). BleDeal عمرو ما يحل الرابط. |
| `ou` | ou | ولا |
| `lire` | Lire | اقرا |
| `latitude` | Latitude | خط العرض (Latitude) |
| `longitude` | Longitude | خط الطول (Longitude) |
| `aLaMain` | Saisir les coordonnées à la main | اكتب الإحداثيات بيدك |
| `trouvee` | Position trouvée · précision ± {m} m | لقينا البلاصة · الدقة ± {m} م |
| `peuPrecise` | Position peu précise (± {m} m) : activez la localisation précise ou le GPS, approchez-vous de la porte, ou déplacez l’épingle. | البلاصة ماشي دقيقة (± {m} م): شعّل الـ GPS، قرّب للباب، ولا حرّك الدبوس. |

#### `espace.partage`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Partager ma boutique | شارك الحانوت نتاعي |
| `texte` | Mettez ce lien dans votre bio Instagram, TikTok ou Facebook, et envoyez-le sur WhatsApp. | حط هاد الرابط في البيو تاع Instagram ولا TikTok ولا Facebook، وابعثو في الواتساب. |
| `copie` | Lien copié | الرابط تنسخ |
| `copieImpossible` | Copie impossible : sélectionnez le lien et copiez-le. | ما قدرناش ننسخو: حدّد الرابط وانسخو. |
| `whatsapp` | Partager sur WhatsApp | ابعث على واتساب |
| `qr` | QR code du lien de {nom} | QR code تاع رابط {nom} |
| `telecharger` | Télécharger le QR code | حمّل QR code |
| `imprimer` | Imprimer l’affiche | اطبع الأفيش |
| `suspendue` | Votre boutique est suspendue : son lien affiche « Boutique indisponible ». | الحانوت نتاعك موقّف: الرابط يبيّن « الحانوت ما راهوش متوفر ». |
| `attente` | Votre lien sera actif dès que votre boutique sera validée par BleDeal. | الرابط نتاعك يخدم كي يقبل BleDeal الحانوت نتاعك. |

#### `espace.conditions`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Conditions commerçants | شروط التجار |
| `intro` | Avant d’utiliser votre espace, lisez et acceptez les conditions commerçants (version du {version}). | قبل ما تخدم بالفضاء نتاعك، اقرا واقبل شروط التجار (النسخة تاع {version}). |
| `francais` **(modifié)** | Le texte officiel des conditions est en français (lien ci-dessous). Ce résumé vous aide à le comprendre ; la traduction complète viendra après la relecture juridique. | النص الرسمي تاع الشروط بالفرنسية (الرابط اللي تحت). هاد الملخص يعاونك باش تفهمو؛ الترجمة الكاملة تجي من بعد المراجعة القانونية. |
| `provisoire` **(nouveau)** | Version provisoire, en cours de relecture juridique. | نسخة مؤقتة، راهي في المراجعة القانونية. |
| `resume1` **(nouveau)** | BleDeal ne vend rien et n’encaisse rien : vous vendez en votre nom et encaissez en espèces au retrait. | BleDeal ما يبيع والو وما يقبض والو: انت اللي تبيع باسمك وتقبض الدراهم كاش كي يجي الزبون يدّي الطلب. |
| `resume2` **(nouveau)** | Authenticité : uniquement des produits authentiques ; pas de contrefaçon ni de produits interdits (alcool, tabac, produits pharmaceutiques…). | السلعة الأصلية برك: ما كاش التقليد ولا السلع الممنوعة (الشراب، الدخان، الدوا…). |
| `resume3` **(nouveau)** | Les données des clients (prénom, nom, téléphone) servent uniquement à la commande en cours. | المعلومات تاع الزبائن (الاسم، اللقب، التيليفون) تخدم غير للطلب اللي راهو ماشي. |
| `resume4` **(nouveau)** | Bons : vous les déduisez en caisse au retrait par QR code ; BleDeal vous les rembourse sur relevé mensuel. Pas de remboursement sans QR code. | البونات: تنقّصهم في الكاسة كي يتسلّم الطلب بالـ QR code؛ وBleDeal يخلّصهملك في الكشف تاع كل شهر. بلا QR code ما كاش تخليص. |
| `resume5` **(nouveau)** | Modération : BleDeal peut masquer un article, avertir ou suspendre la boutique ; chaque décision est enregistrée. | المراقبة: BleDeal يقدر يخبّي سلعة، ينبّهك ولا يوقّف الحانوت؛ وكل قرار يتسجّل. |
| `lire` | Lire les conditions commerçants | اقرا شروط التجار |
| `confidentialite` | Politique de confidentialité | سياسة الخصوصية |
| `case` | J’ai lu et j’accepte les conditions commerçants (version du {version}) et la politique de confidentialité. | قريت ونقبل شروط التجار (النسخة تاع {version}) وسياسة الخصوصية. |
| `accepter` | Accepter | نقبل |
| `connexionPerdue` | Connexion perdue. Réessayez. | الأنترنت راحت. عاود جرّب. |

#### `espace.bons`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` **(nouveau)** | Bons à rembourser | البونات اللي نخلّصوهملك |
| `ceMois` **(nouveau)** | Ce mois-ci : {resume} | هاد الشهر: {resume} |
| `resume` **(nouveau)** | {bons} · {montant} | {bons} · {montant} |
| `un` **(nouveau)** | {n} bon | {n} بون |
| `plusieurs` **(nouveau)** | {n} bons | {n} بونات |
| `parOrigine` **(nouveau)** | Par origine | حسب المصدر |
| `plafond` **(nouveau)** | Plafond {nom} : {compte} bons dans votre boutique. | الحد تاع {nom}: {compte} بون في الحانوت نتاعك. |
| `paye` **(nouveau)** | {mois} : {montant} · payé le {date} | {mois}: {montant} · تخلّص نهار {date} |
| `payeReference` **(nouveau)** | {mois} : {montant} · payé le {date}, réf. {reference} | {mois}: {montant} · تخلّص نهار {date}، المرجع {reference} |
| `aPayer` **(nouveau)** | {mois} : {montant} · à payer avant le {date} | {mois}: {montant} · يتخلّص قبل {date} |
| `enCours` **(nouveau)** | {mois} : {montant} · en cours | {mois}: {montant} · مازال الشهر ما كملش |
| `detail` **(nouveau)** | Détail des commandes | التفاصيل تاع الطلبات |
| `ligne` **(nouveau)** | N° {numero} · {origine} · {date} | رقم {numero} · {origine} · {date} |
| `origineParrainage` **(nouveau)** | Parrainage | العرضة |
| `origineBienvenue` **(nouveau)** | Bienvenue | مرحبا |
| `origineInscription` **(nouveau)** | Inscription en boutique | التسجيل في الحانوت |
| `origineCampagne` **(nouveau)** | Campagne | حملة |
| `origineAvis` **(nouveau)** | Avis | رأي |
| `etatARembourser` **(nouveau)** | À rembourser | باش يتخلّص |
| `etatDeCote` **(nouveau)** | Mise de côté | محطوطة على جنب |
| `etatRefuse` **(nouveau)** | Refusée | مرفوضة |
| `partBoutique` **(nouveau)** | Bon de bienvenue d’un client inscrit chez vous : vous déduisez tout le bon en caisse et BleDeal vous rembourse le bon moins votre part. | بون مرحبا تاع زبون تسجّل عندك: تنقّص البون كامل في الكاسة، وBleDeal يخلّصلك البون ناقص الحصة نتاعك. |
| `explication` **(nouveau)** | BleDeal vous rembourse chaque mois les bons (parrainage, bienvenue, campagnes) déduits sur des commandes remises par QR code (relevé clôturé le 1er, paiement avant le 10). Par code à 6 chiffres, le bon ne s’applique pas. | BleDeal يخلّصلك كل شهر البونات (العرضة، مرحبا، الحملات) اللي نقّصتهم في طلبات تسلّمت بالـ QR code (الكشف يتسكّر نهار 1، والخلاص قبل نهار 10). بالكود تاع 6 أرقام، البون ما يتحسبش. |

#### `espace.connexion`

| Clé | Français | Arabe (à valider) |
|---|---|---|
| `titre` | Se connecter | ادخل |
| `sousTitre` | Votre espace commerçant | فضاء التاجر نتاعك |
| `lienInvalide` | Ce lien de connexion est invalide, expiré ou déjà utilisé. Demandez un nouveau lien. | هاد رابط الدخول ماشي صالح، فات وقتو ولا تخدم من قبل. اطلب رابط جديد. |

## Messages traduits à l’affichage (`lib/textes/messages.ts`)

| Français (message du serveur, de lib/ ou de la base) | Arabe (à valider) |
|---|---|
| Position retirée. | البلاصة تنحّات. |
| Position enregistrée. | البلاصة تسجّلت. |
| Impossible d’enregistrer la position. Réessayez. | ما قدرناش نسجّلو البلاصة. عاود جرّب. |
| Vérifiez les champs du formulaire. | شوف الخانات تاع الفورمولار. |
| Vérifiez les champs du formulaire avant de publier. | شوف الخانات تاع الفورمولار قبل ما تنشر. |
| Choisissez de 1 à 5 photos JPEG de moins de 5 Mo. | اختار من 1 حتى 5 تصاور JPEG، كل وحدة أقل من 5 ميغا. |
| Chaque photo doit avoir sa miniature JPEG de moins de 150 Ko. Rechargez la page et réessayez. | كل صورة لازم تكون عندها صورة صغيرة JPEG أقل من 150 كيلو. عاود حمّل الصفحة وجرّب. |
| Les photos dépassent 4 Mo au total. Retirez une photo ou choisissez des images plus légères. | التصاور فاتو 4 ميغا في المجموع. نحّي صورة ولا اختار تصاور أخف. |
| Une photo n’est pas un vrai fichier JPEG. Choisissez une autre image. | كاين صورة ماشي JPEG صحيح. اختار صورة أخرى. |
| Une miniature n’est pas un vrai fichier JPEG. Choisissez une autre image. | كاين صورة صغيرة ماشي JPEG صحيح. اختار صورة أخرى. |
| Votre compte n’est pas rattaché à cette boutique. | الحساب نتاعك ماشي مربوط بهاد الحانوت. |
| Impossible de publier l’article. Réessayez. | ما قدرناش ننشرو السلعة. عاود جرّب. |
| Impossible de publier l’article. | ما قدرناش ننشرو السلعة. |
| Choisissez des tailles valides. | اختار مقاسات صحاح. |
| Les photos sélectionnées sont invalides. | التصاور اللي اخترتهم ماشي صحاح. |
| Impossible d’enregistrer l’article. Réessayez. | ما قدرناش نسجّلو السلعة. عاود جرّب. |
| Demande invalide. | الطلب ماشي صحيح. |
| Commande introuvable. | ما لقيناش الطلب. |
| Commande mise à jour. | الطلب تبدّل. |
| Impossible de modifier la commande. Réessayez. | ما قدرناش نبدّلو الطلب. عاود جرّب. |
| Impossible de modifier les commandes. Réessayez. | ما قدرناش نبدّلو الطلبات. عاود جرّب. |
| « Client pas venu » est possible seulement quand la commande prête n’a pas été récupérée dans les 24 heures. | « الزبون ما جاش » تقدر تديرها غير إلا الطلب الواجد ما تدّاش في 24 ساعة. |
| C’est noté : le client est averti. | تسجّلت: الزبون جاه تنبيه. |
| Impossible de signaler ce client. Réessayez. | ما قدرناش نبلّغو على هاد الزبون. عاود جرّب. |
| Cochez la case pour accepter les conditions. | علّم على الخانة باش تقبل الشروط. |
| Connectez-vous pour accepter les conditions. | ادخل لحسابك باش تقبل الشروط. |
| Tapez les 6 chiffres du code. | اكتب الأرقام الستة تاع الكود. |
| Impossible de lire cette commande. Réessayez. | ما قدرناش نقراو هاد الطلب. عاود جرّب. |
| Ce QR code n’est pas valide pour votre boutique. | هاد QR code ماشي صالح للحانوت نتاعك. |
| Commande remise | الطلب تسلّم |
| Impossible de remettre cette commande. Réessayez. | ما قدرناش نسلّمو هاد الطلب. عاود جرّب. |
| Impossible de charger les commandes. Réessayez. | ما قدرناش نحمّلو الطلبات. عاود جرّب. |
| Impossible de chercher les commandes. Réessayez. | ما قدرناش نقلّبو على الطلبات. عاود جرّب. |
| Action impossible. | ما نقدروش نديرو هادي. |
| Cochez au moins une commande. | علّم على طلب واحد على الأقل. |
| Retrait indisponible. | التسليم ما راهوش متوفر. |
| Connectez-vous à votre espace boutique. | ادخل لفضاء الحانوت نتاعك. |
| Trop de codes faux : la saisie du code est bloquée pour le moment. Scannez le QR code du client. | كودات غالطين بزاف: الكتابة تاع الكود مبلوكية دابا. سكاني QR code تاع الزبون. |
| Code faux. Vérifiez les 6 chiffres avec le client. | الكود غالط. شوف الأرقام الستة مع الزبون. |
| Cette commande a déjà été remise. | هاد الطلب تسلّم من قبل. |
| Cette commande a été annulée. | هاد الطلب تلغى. |
| Cette commande a expiré : elle n’est plus à remettre. | هاد الطلب فات وقتو: ما بقاش يتسلّم. |
| Ce n’est pas un QR code de retrait BleDeal. | هادا ماشي QR code تاع الاستلام في BleDeal. |
| La caméra est bloquée. Autorisez-la dans les réglages du navigateur (cadenas à côté de l’adresse), ou tapez le code. | الكاميرا مبلوكية. خلّيها تخدم في إعدادات المتصفح (القفل اللي حدا العنوان)، ولا اكتب الكود. |
| Article masqué par la modération : contactez l’administrateur pour le rendre visible. | السلعة خبّاتها المراقبة: اتصل بالإدارة باش ترجع تبان. |
| Le prix doit rester supérieur au prix promo, ou arrêtez d'abord la promo | السومة لازم تبقى كثر من سومة التخفيض، ولا وقّف التخفيض الأول |
| Le chemin d’une photo est invalide. L’article a été conservé. | الطريق تاع صورة ماشي صحيح. السلعة بقات. |
| Votre session a expiré. Reconnectez-vous. | الجلسة نتاعك فات وقتها. عاود ادخل. |
| Impossible de charger votre profil. Réessayez. | ما قدرناش نحمّلو الحساب نتاعك. عاود جرّب. |
| Votre compte n’est rattaché à aucune boutique | الحساب نتاعك ماشي مربوط بحتى حانوت |
| Votre compte n’est rattaché à aucune boutique. | الحساب نتاعك ماشي مربوط بحتى حانوت. |
| Cet article est introuvable dans votre boutique. | ما لقيناش هاد السلعة في الحانوت نتاعك. |
| Choisissez un statut valide. | اختار حالة صحيحة. |
| Impossible de changer le statut. Réessayez. | ما قدرناش نبدّلو الحالة. عاود جرّب. |
| Conservez entre 1 et 5 photos de cet article. | خلّي من 1 حتى 5 تصاور لهاد السلعة. |
| Les informations ont été enregistrées, mais pas les tailles. Réessayez d’enregistrer. | المعلومات تسجّلو، بصح المقاسات لا. عاود سجّل. |
| Les nouvelles photos sont enregistrées, mais les anciennes n’ont pas pu être retirées. Rechargez la page avant de réessayer. | التصاور الجداد تسجّلو، بصح القدام ما تنحّاوش. عاود حمّل الصفحة قبل ما تعاود. |
| Les photos sont mises à jour, mais le nettoyage du stockage a échoué. Contactez l’administrateur. | التصاور تبدّلو، بصح التنقية تاع التخزين ما نجحتش. اتصل بالإدارة. |
| Les photos sont enregistrées, mais leur ordre n’a pas pu être mis à jour. Rechargez la page. | التصاور تسجّلو، بصح الترتيب نتاعهم ما تبدّلش. عاود حمّل الصفحة. |
| L’envoi des photos a échoué et le nettoyage est incomplet. Contactez l’administrateur. | التصاور ما تبعثوش والتنقية ما كملتش. اتصل بالإدارة. |
| Les champs sont enregistrés, mais les photos n’ont pas été modifiées. Réessayez. | الخانات تسجّلو، بصح التصاور ما تبدّلوش. عاود جرّب. |
| Impossible de supprimer les photos. L’article a été conservé ; réessayez. | ما قدرناش نحذفو التصاور. السلعة بقات؛ عاود جرّب. |
| Les photos ont été supprimées, mais l’article a été conservé. Réessayez de le supprimer. | التصاور تحذفو، بصح السلعة بقات. عاود جرّب تحذفها. |
| Le texte arabe doit contenir au maximum 1 121 caractères. | النص بالعربية ما يفوتش 1 121 حرف. |
| Ajoutez au moins une photo. | زيد صورة وحدة على الأقل. |
| Vous pouvez ajouter au maximum 5 photos. | تقدر تزيد 5 تصاور على الأكثر. |
| Choisissez des photos JPEG, PNG ou WebP non vides. | اختار تصاور JPEG ولا PNG ولا WebP ماشي فارغين. |
| Le titre doit contenir entre 2 et 120 caractères. | العنوان لازم يكون من 2 حتى 120 حرف. |
| Choisissez une catégorie. | اختار النوع. |
| Choisissez un genre. | اختار لمن. |
| Choisissez une couleur dans la liste. | اختار لون من الليستة. |
| Saisissez un prix entier en DA, supérieur à 0. | اكتب سومة كاملة بالدينار، كثر من 0. |
| Ce prix est trop élevé. | هاد السومة غالية بزاف. |
| Choisissez au moins une contenance (ou « Unique »). | اختار حجم واحد على الأقل (ولا « واحد »). |
| Choisissez au moins une taille. | اختار مقاس واحد على الأقل. |
| La taille unique ne se combine pas avec d’autres tailles. | المقاس الواحد ما يتخلطش مع مقاسات أخرى. |
| Choisissez uniquement les contenances proposées. | اختار غير الأحجام اللي كاينين. |
| Choisissez uniquement les tailles proposées pour cette catégorie et ce genre. | اختار غير المقاسات اللي كاينين لهاد النوع ولهادو. |
| Saisissez la latitude et la longitude, ou aucune des deux. | اكتب خط العرض وخط الطول، ولا حتى واحد فيهم. |
| Pour déplacer votre boutique sur la carte, contactez BleDeal. | باش تبدّل بلاصة الحانوت في الخريطة، اتصل بـ BleDeal. |
| Ce lien court ne contient pas la position. Ouvrez-le dans Google Maps, puis copiez l’adresse complète depuis la barre du navigateur (elle contient « @35,… »), ou utilisez « Je suis dans la boutique ». | هاد الرابط القصير ما فيهش البلاصة. حلّو في Google Maps، ومن بعد انسخ العنوان كامل من الفوق تاع المتصفح (فيه « @35,… »)، ولا اختار « راني في الحانوت ». |
| Coordonnées introuvables dans ce lien. | ما لقيناش الإحداثيات في هاد الرابط. |
| Vous avez refusé la localisation. Collez un lien Google Maps ou placez l’épingle. | رفضت تعطي البلاصة. حط رابط Google Maps ولا حط الدبوس. |
| Position introuvable pour le moment. Réessayez dehors ou près d’une fenêtre. | ما لقيناش البلاصة دابا. عاود جرّب برّا ولا حدا طاقة. |
| La localisation n’est pas disponible sur cet appareil. Collez un lien Google Maps ou placez l’épingle. | البلاصة ما تخدمش في هاد التيليفون. حط رابط Google Maps ولا حط الدبوس. |
| Impossible de charger les titres de vos articles. Réessayez. | ما قدرناش نحمّلو العناوين تاع السلع نتاعك. عاود جرّب. |
| Impossible de charger vos statistiques. Réessayez. | ما قدرناش نحمّلو الإحصائيات نتاعك. عاود جرّب. |
| Saisissez un prix promo entier en DA, supérieur à 0. | اكتب سومة تخفيض كاملة بالدينار، كثر من 0. |
| Le prix promo doit être inférieur au prix normal. | سومة التخفيض لازم تكون أقل من السومة العادية. |
| Choisissez une date de fin. | اختار تاريخ النهاية. |
| Saisissez une date de fin valide. | اكتب تاريخ نهاية صحيح. |
| La date de fin doit être dans le futur. | تاريخ النهاية لازم يكون من بعد اليوم. |
| Choisissez un badge. | اختار علامة. |
| Impossible de confirmer l’article. La promo n’a pas été modifiée. | ما قدرناش نتأكدو من السلعة. التخفيض ما تبدّلش. |
| Impossible d’enregistrer la promo. Réessayez. | ما قدرناش نسجّلو التخفيض. عاود جرّب. |
| Impossible d’arrêter la promo. Réessayez. | ما قدرناش نوقّفو التخفيض. عاود جرّب. |
| La photo compressée doit être un JPEG de moins de 5 Mo. | الصورة المضغوطة لازم تكون JPEG أقل من 5 ميغا. |
| La miniature de la photo doit être un JPEG de moins de 150 Ko. | الصورة الصغيرة لازم تكون JPEG أقل من 150 كيلو. |
| Les dimensions de la photo sont invalides. | القياسات تاع الصورة ماشي صحاح. |
| La compression des photos est indisponible dans ce navigateur. | ضغط التصاور ما يخدمش في هاد المتصفح. |
| Impossible de compresser cette photo. | ما قدرناش نضغطو هاد الصورة. |
| Choisissez une photo JPEG, PNG ou WebP non vide. | اختار صورة JPEG ولا PNG ولا WebP ماشي فارغة. |
| Impossible de lire cette photo. Choisissez une autre image JPEG, PNG ou WebP. | ما قدرناش نقراو هاد الصورة. اختار صورة أخرى JPEG ولا PNG ولا WebP. |
| La photo compressée dépasse 5 Mo. Choisissez une autre photo. | الصورة المضغوطة فاتت 5 ميغا. اختار صورة أخرى. |
| La miniature de la photo est trop lourde. Choisissez une autre photo. | الصورة الصغيرة ثقيلة بزاف. اختار صورة أخرى. |
| Impossible d’enregistrer le stock. Réessayez. | ما قدرناش نسجّلو السطوك. عاود جرّب. |
| Le stock est enregistré, mais le statut de l’article n’a pas pu être relu. Rechargez la page. | السطوك تسجّل، بصح ما قدرناش نعاودو نقراو حالة السلعة. عاود حمّل الصفحة. |
| La traduction est indisponible, vous pouvez écrire le texte arabe à la main | الترجمة ما راهيش متوفرة، تقدر تكتب النص بالعربية بيدك |
| Saisissez un titre et une description valides. | اكتب عنوان ووصف صحاح. |
| Le titre doit contenir entre 1 et 120 caractères. | العنوان لازم يكون من 1 حتى 120 حرف. |
| La description doit contenir au maximum 1 000 caractères. | الوصف ما يفوتش 1 000 حرف. |
| L’IA est indisponible, remplissez la fiche à la main | الذكاء الاصطناعي ما راهوش متوفر، عمّر الفيشة بيدك |
| Prenez une autre photo du vêtement, bien éclairée et nette | صوّر اللبسة مرة أخرى، في الضو ومليحة |
| Changement de statut impossible. | ما نقدروش نبدّلو الحالة. |
| Cette commande est terminée. | هاد الطلب كمل. |
| Connectez-vous pour modifier une commande. | ادخل لحسابك باش تبدّل طلب. |
| Réservé à la boutique. | غير للحانوت. |
| Réservé aux commerçants. | غير للتجار. |
| Boutique publiée : seul un administrateur peut modifier le nom, le WhatsApp, la position ou les liens. | الحانوت راهو في الموقع: غير الإدارة تقدر تبدّل الاسم، الواتساب، البلاصة ولا الروابط. |
| Non autorisé | ما عندكش الحق |
| la commande est annulée. | الطلب تلغى. |
| la commande est expirée. | الطلب فات وقتو. |

**Messages avec valeurs** (modèles) :

| Français | Arabe (à valider) |
|---|---|
| Impossible d’enregistrer l’article. … Aucun article n’a été publié. Vous pouvez réessayer. | ما قدرناش ننشرو السلعة. ما تنشرت حتى سلعة. تقدر تعاود. |
| Impossible de … Le nettoyage n’a pas pu être terminé. Contactez l’administrateur avant de republier. | ما قدرناش ننشرو السلعة. التنقية ما كملتش. اتصل بالإدارة قبل ما تعاود تنشر. |
| Déjà remise le {date}. | تسلّم من قبل نهار $1. |
| Stock insuffisant pour « {titre} » en taille {t} : il reste {n} pièce(s), la commande en demande {m}. … | السطوك ما يكفيش لـ « $1 » ($3): بقاو $4، والطلب فيه $5. صلّح السطوك في « السلع نتاعي » ولا الغي الطلب بالسبب « ما بقاش في السطوك ». |
| La quantité doit être un nombre entier entre 0 et {max}. | الكمية لازم تكون عدد كامل من 0 حتى $1. |
| {n} au plus à la fois. | $1 على الأكثر في خطرة. |
| La position doit être dans la wilaya d’{ville}. | البلاصة لازم تكون في ولاية $1. |
| … Retirez ou corrigez d’abord la position. | $1 نحّي ولا صلّح البلاصة الأول. |
