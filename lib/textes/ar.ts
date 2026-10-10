// US-23 : textes arabes (arabe simple, darja oranaise quand c'est plus naturel ; masculin générique).
// Les 10 textes de la story US-23 ont été validés par le propriétaire le 9/10/2026 : ils sont repris tels quels
// (marqués « validé »). Les autres suivent le même style.
import type { Textes } from "./fr";

export const ar: Textes = {
  entete: {
    navigation: "تصفح الموقع",
    rechercher: "ابحث",
    panier: "السلة",
    carte: "الخريطة", // US-24, texte 1
    panierUnArticle: "السلة (1)",
    panierArticles: "السلة ({n})",
    changerVille: "بدّل المدينة، المدينة دروك: {ville}",
  },
  villes: {
    metaTitre: "اختار مدينتك",
    titre: "اختار مدينتك",
    texte: "التخفيضات والحوانيت على حساب المدينة. تقدر تبدّلها وقتما حبيت.",
    localiser: "لقاني وين راني",
    recherche: "راني نحوّس على البلاصة تاعك…",
    confidentialite: "البلاصة تاعك تبقى في التيليفون: ما تتبعثش وما تتسجلش.",
    proche: "راك قريب من {ville}.",
    horsVilles: "مازال ما كاش حوانت BleDeal قريب منك: اختار مدينة من هنا.",
    introuvable: "ما لقيناش البلاصة تاعك: اختار مدينة من هنا.",
    inconnue: "هاد المدينة مازالت ما راهيش في BleDeal.",
    boutiqueUne: "{n} حانوت",
    boutiques: "{n} حانوت",
    liste: "المدن",
    actuelle: "المدينة دروك",
  },
  langue: {
    groupe: "اللغة",
    autre: "FR",
    autreNom: "Français",
    autreCode: "fr",
  },
  erreur: {
    titre: "كاين مشكل", // validé
    reessayer: "عاود جرّب", // validé
  },
  introuvable: {
    titre: "هاد الصفحة ما كايناش",
    retour: "ارجع للصفحة الرئيسية",
  },
  listes: {
    univers: { femme: "نساء", homme: "رجال", enfant: "أطفال", beaute: "تجميل" },
    genres: { homme: "رجال", femme: "نساء", enfant: "أطفال", mixte: "للجميع" },
    genresBeaute: { femme: "ليها", homme: "ليه", mixte: "للجوج" },
    raccourcisBeaute: { "Parfums": "عطور", "Maquillage": "ماكياج", "Soins visage et corps": "العناية", "Cheveux": "الشعر", "Hammam et traditionnel": "حمّام" },
    groupesCategories: { mode: "لبسة", beaute: "تجميل" },
    categories: {
      "T-shirts et polos": "تيشيرتات وبولو",
      "Chemises": "قمجان",
      "Pulls et sweats": "تريكوات وسويتات",
      "Vestes et manteaux": "جاكيطات ومانطوات",
      "Pantalons et jeans": "سراول وجينز",
      "Survêtements et ensembles": "سورفيتات وأطقم",
      "Robes": "روبات",
      "Jupes": "جيبات",
      "Abayas, djellabas, kamis": "عبايات، جلابات، قمصان",
      "Tenues traditionnelles": "لبسة تقليدية",
      "Hijabs et foulards": "حجابات ومحارم",
      "Chaussures": "صبابط",
      "Sacs": "صاكات",
      "Accessoires": "إكسسوارات",
      "Parfums": "عطور",
      "Maquillage": "ماكياج",
      "Soins visage et corps": "العناية بالوجه والجسم",
      "Cheveux": "الشعر",
      "Hammam et traditionnel": "حمّام وتقليدي",
    },
    tailleUnique: "مقاس واحد",
  },
  accueil: {
    univers: "الأقسام",
    titre: "بروموات {deVille}", // {deVille} : en arabe, le nom seul (« وهران »)
    sousTitre: "احجز على واتساب · خلّص في الحانوت",
    voirPromos: "شوف التخفيضات", // validé
    creditPhoto: "الصورة:",
    lesUnivers: "الأقسام",
    piecesPhares: "أهم السلع",
    enCeMoment: "دابا",
    toutVoir: "شوف الكل",
    espaceCommercant: "فضاء التجار",
  },
  promos: {
    aucune: "ما كاين حتى تخفيض دابا. ارجع قريب تشوف الجديد.",
    chargement: "راهو يتحمّل…",
    erreurSuite: "ما قدرناش نحمّلو الباقي. عاود جرّب.",
    reessayer: "عاود جرّب",
    voirPlus: "شوف تخفيضات أخرى",
  },
  carte: {
    aucunePhoto: "ما كانش صورة",
    reduction: "\u2066−{n}%\u2069", // isolé de gauche à droite : « −30% » ne devient pas « 30%− »
  },
  catalogue: {
    titre: "كل السلع",
    rechercherArticle: "ابحث على سلعة",
    exemple: "بولو، جينز، روبة، عطر…",
    filtres: "الفلاتر",
    univers: "القسم",
    categorie: "النوع",
    toutes: "الكل",
    tous: "الكل",
    taille: "المقاس",
    genre: "لمن",
    quartier: "الحي",
    prixMin: "أقل سعر (دج)",
    prixMax: "أعلى سعر (دج)",
    enPromo: "غير اللي فيهم تخفيض",
    rechercher: "ابحث",
    effacer: "امسح الفلاتر",
    unResultat: "النتائج: {n}",
    resultats: "النتائج: {n}",
    aucun: "ما لقينا حتى سلعة. جرّب كلمات أخرى ولا امسح الفلاتر.",
    aucunBeaute: "ما كاين حتى منتوج تجميل دابا.",
    aucunVille: "مازال ما كاش سلعة في {ville}.",
    contenance: "الحجم",
    pour: "لمن",
    tout: "كامل",
    categoriesBeaute: "أصناف التجميل",
    pagination: "صفحات الكتالوغ",
    precedent: "السابق",
    suivant: "التالي",
    tri: "رتّب",
    recents: "الجداد",
    mieuxNotees: "الأحسن في النقاط",
  },
  fiche: {
    retour: "رجوع",
    aucunePhoto: "ما كانش صورة",
    jusquAu: "حتى {date}",
    plusDisponible: "هاد السلعة ما بقاتش", // validé
    vendu: "هاد السلعة تباعت",
    autresArticles: "سلع أخرى من نفس الحانوت",
    aucunAutre: "ما كانش سلع أخرى دابا",
    photosDe: "صور {titre}",
    galerie: "معرض الصور",
    photoN: "{titre} — صورة {n} من {total}",
    photoPrecedente: "الصورة اللي قبل",
    photoSuivante: "الصورة اللي بعد",
    voirPhoto: "شوف الصورة {n}",
    photoSur: "صورة {n} من {total}",
    partager: "شارك",
    lienCopie: "الرابط تنسخ",
    partageImpossible: "ما قدرناش نشاركو الرابط.",
    taille: "المقاس",
    tailleN: "مقاس {taille}",
    tailleEpuisee: "مقاس {taille}، ما بقاش",
    choisirTaille: "اختار المقاس باش تطلب.",
    aucuneTaille: "ما كاين حتى مقاس دابا.",
    contenance: "الحجم",
    contenanceN: "الحجم {taille}",
    contenanceEpuisee: "{taille}، ما بقاش",
    choisirContenance: "اختار الحجم باش تطلب.",
    aucuneContenance: "ما كاين حتى حجم دابا.",
    quantite: "الكمية",
    quantiteN: "الكمية: {n}",
    moins: "نقّص وحدة",
    plus: "زيد وحدة",
    ajouter: "زيد للسلة", // validé
    ajoute: "تزادت للسلة.",
    voirPanier: "شوف السلة",
    viderEtAjouter: "فرّغ السلة وزيد",
    ajoutImpossible: "ما قدرناش نزيدو السلعة للسلة.",
    confirmation: "الحانوت يأكّد طلبك. الخلاص في الحانوت.", // « الخلاص في الحانوت » validé
    question: "عندك سؤال؟ واتساب",
  },
  signaler: {
    bouton: "بلّغ على هاد السلعة",
    motif: "علاش تبلّغ؟",
    choisir: "اختار السبب",
    contrefacon: "سلعة مقلّدة",
    contenuInapproprie: "محتوى ماشي لايق",
    arnaque: "تحايل",
    autre: "سبب آخر",
    commentaire: "تعليق (إذا حبيت)",
    envoi: "راهو يتبعث…",
    envoyer: "ابعث البلاغ",
    choisirMotif: "اختار السبب.",
    echec: "البلاغ ما تبعثش. عاود جرّب.",
  },
  vitrine: {
    partager: "شارك الحانوت",
    adresseInconnue: "العنوان ما كانش",
    horairesInconnus: "الأوقات ما كانش",
    whatsapp: "واتساب",
    itineraire: "الطريق",
    localisation: "بلاصة الحانوت",
    carte: "الخريطة: {nom}",
    itineraireVers: "الطريق إلى {nom}",
    articles: "السلع الموجودة · التخفيضات اللولين",
    aucun: "ما كاين حتى سلعة دابا.",
    indisponible: "الحانوت ما راهوش متوفر",
    retour: "ارجع للصفحة الرئيسية",
  },
  // US-31.2 : textes arabes à faire valider par le propriétaire.
  suivre: {
    suivre: "تبّع",
    suivie: "✓ راك تتبّع",
    enCours: "لحظة…",
    confirmer: "ما تبقاش تتبّع {nom}؟",
    nePlusSuivre: "ما تبقاش تتبّع",
    garder: "خلّيها",
    mesBoutiques: "الحوانت نتاعي ({n})",
    titre: "الحوانت نتاعي",
    vide: "ما راك تتبّع حتى حانوت. اضغط « تبّع » في صفحة الحانوت باش تلقاه هنا.",
    voirCarte: "لقى حوانت",
    promos: "{n} تخفيضات دابا",
    unePromo: "تخفيض واحد دابا",
    aucunePromo: "ما كاين حتى تخفيض دابا",
    connexion: "ادخل لحسابك باش تتبّع الحانوت.",
    plafond: "راك تتبّع 200 حانوت: حبّس واحد باش تزيد آخر.",
    introuvable: "هاد الحانوت ما راهوش متوفر.",
    reserve: "غير حسابات الزبائن يقدرو يتبّعو الحوانت.",
    erreur: "ما قدرناش دابا. عاود جرّب.",
    bienvenueTitre: "مرحبا بيك عند {nom}",
    bienvenueTexte: "دير حسابك في BleDeal: تتبّع الحانوت وتحجز السلعة نتاعو من التيليفون، وتخلّص في الحانوت.",
    creerCompte: "دير حسابي",
    // US-31.4 : nouveaux, à valider.
    bonInscription: "بون مرحبا تاع {montant} كي تشري {minimum} ولا كثر، يخدم من غدوة في هاد الحانوت، ودروك في الحوانت الأخرين.", // à valider
    bonInscriptionNumero: "من بعد ما تأكّد النمرة نتاعك. تدّي بالـ QR code.", // à valider
    bonDonne: "بون مرحبا راهو في الحساب نتاعك، « البونات نتاعي ».", // à valider
    bonApresNumero: "أكّد النمرة نتاعك في الحساب باش يجيك بون مرحبا.", // à valider
  },
  // US-31.5 : textes arabes à faire valider par le propriétaire (n° 9 et 10 du module 17 ; les autres sont nouveaux).
  alertes: {
    vousSuivez: "راك تتبّع {nom}. تلقاه في الحساب نتاعك، « الحوانت نتاعي ».", // à valider
    caseAccord: "نحب يجيني على الواتساب البروموات الجداد تاع الحوانت اللي نتبّعهم (ميساج واحد في النهار على الأكثر). نقدر نحبّس وقتما حبيت.",
    enregistrer: "سجّل", // à valider
    enCours: "لحظة…",
    activees: "التنبيهات في الواتساب راهي خدّامة: ميساج واحد في النهار على الأكثر، كي يكون عند حانوت تتبّعو بروموات جداد.", // à valider
    pasDAlerte: "مليح: ما يجيك حتى تنبيه في الواتساب.", // à valider
    titre: "التنبيهات في الواتساب", // à valider
    etatActives: "خدّامين: ميساج واحد في النهار على الأكثر.", // à valider
    etatDesactivees: "محبوسين.", // à valider
    activer: "شعّل", // à valider
    desactiver: "حبّس", // à valider
    connexion: "ادخل لحسابك باش تتحكّم في التنبيهات.", // à valider
    nonProposees: "التنبيهات في الواتساب مازال ما كانوش.", // à valider
    erreur: "ما قدرناش دابا. عاود جرّب.",
    lienQuestion: "ما تحبش يجيوك على الواتساب البروموات الجداد تاع الحوانت اللي تتبّعهم؟", // à valider
    lienBouton: "ما نحبش", // à valider
    lienFait: "ما عادش يجيوك الميساجات.",
    lienToujours: "مازال راك تتبّع الحوانت نتاعك.", // à valider
    lienInvalide: "هاد الرابط ما يخدمش.", // à valider
    mesBoutiques: "الحوانت نتاعي",
  },
  panier: {
    titre: "السلة ديالي",
    vide: "السلة فارغة.",
    voirArticles: "شوف السلع",
    articles: "السلع في السلة",
    photo: "صورة",
    tailleEtPrix: "مقاس {taille} · {prix}",
    contenanceEtPrix: "{taille} · {prix}",
    moins: "{titre} {taille}: نقّص وحدة",
    plus: "{titre} {taille}: زيد وحدة",
    retirer: "نحّي {titre} ({taille})",
    note: "كلمة للحانوت (إذا حبيت)",
    noteTropLongue: "الكلمة لازم ما تفوتش {max} حرف.",
    total: "المجموع",
    seConnecter: "ادخل لحسابك باش تطلب",
    verifierTitre: "أكّد رقمك باش تطلب",
    verifierTexte: "يجيك كود فيه 6 أرقام على واتساب. الحانوت يتصل بيك على هاد الرقم.",
    profilNom: "قبل أول طلب، اكتب اسمك.",
    profilNomTelephone: "قبل أول طلب، اكتب اسمك ورقم الواتساب ديالك.",
    enregistrerContinuer: "سجّل وكمّل",
    envoi: "راهو يتبعث…",
    commander: "اطلب", // validé
    envoiImpossible: "ما قدرناش نبعثو الطلب. عاود جرّب.",
    connexionPerdue: "ما قدرناش نبعثو الطلب. شوف الأنترنت ديالك وعاود جرّب.",
    mention: "الحانوت يأكّد طلبك · الخلاص في الحانوت · سلة وحدة لكل حانوت",
  },
  compte: {
    navigation: "حسابي",
    monCompte: "حسابي",
    monProfil: "معلوماتي",
    mesCommandes: "طلباتي",
    panier: "السلة",
    seDeconnecter: "اخرج",
    monEspace: "فضاء الحانوت ديالي",
    chargementImpossible: "ما قدرناش نحمّلو معلوماتك. عاود جرّب.",
    deconnexionImpossible: "ما قدرناش نخرجوك. عاود جرّب.",
  },  // US-34.4 : « المعلومات نتاعي » (texte n° 8 de la conception) ; les autres textes sont nouveaux, à valider.
  donnees: {
    mesDonnees: "المعلومات نتاعي",
    intro: "واش تحفظ BleDeal على الحساب نتاعك، بالتواريخ.", // à valider
    numero: "النمرة",
    numeroVerifie: "{numero} · مأكّدة نهار {date}", // à valider
    numeroNonVerifie: "{numero} · ماشي مأكّدة", // à valider
    aucun: "ما كاينش",
    aucune: "ما كاينش",
    nom: "الاسم",
    compte: "الحساب",
    creeLe: "تحلّ نهار {date}", // à valider
    commandes: "الطلبات",
    bons: "البونات",
    avis: "الآراء",
    nombreDernier: "{n} · آخر واحد نهار {date}", // à valider
    nombreDerniere: "{n} · آخر واحد نهار {date}", // à valider
    boutiques: "الحوانت اللي تتبّعهم",
    suivieDepuis: "{nom} · من {date}", // à valider
    accords: "الموافقات", // à valider
    accord: "{document}، النسخة تاع {version} · قبلتها نهار {date}", // à valider
    droits: "نسخة، تصحيح، مسح ولا رفض: الحقوق نتاعك وكيفاش تطلبهم راهم في", // à valider
    lienPolitique: "سياسة الخصوصية",
    chargementImpossible: "ما قدرناش نحمّلو المعلومات نتاعك. عاود جرّب.",
    retour: "رجوع للحساب نتاعي",
  },

  profil: {
    nom: "الاسم واللقب",
    telephone: "رقم الواتساب",
    contact: "الحانوت يتصل بيك على هاد الرقم على جال طلبك.",
    enregistrer: "سجّل",
    enregistrement: "راهو يتسجّل…",
  },
  numero: {
    verifie: "الرقم مأكّد",
    changer: "بدّل الرقم",
    verifierTitre: "أكّد رقمك باش تطلب",
    verifierTexte: "نبعثولك كود فيه 6 أرقام على واتساب. الحانوت يتصل بيك على هاد الرقم.",
  },
  connexion: {
    titre: "ادخل لحسابك",
    sousTitre: "باش تطلب وتتبّع طلباتك",
    lienInvalide: "رابط الدخول هذا غالط، ولا فات وقتو، ولا تستعمل من قبل. اطلب رابط جديد.",
    avecEmail: "ادخل بالإيميل (حساب مسجّل بالإيميل)",
    avecNumero: "ادخل برقم التيليفون",
    email: "الإيميل",
    emailAide: "يجيك رابط باش تدخل بلا كلمة سر.",
    emailRecevoir: "ابعثلي رابط الدخول",
    envoi: "راهو يتبعث…",
    emailInvalide: "اكتب إيميل صحيح.",
    antiRobot: "أكّد بلي راك ماشي روبو قبل.",
    emailEnvoye: "بعثنالك رابط الدخول في الإيميل",
    emailImpossible: "ما قدرناش نبعثو رابط الدخول. عاود جرّب من بعد شوية.",
  },
  code: {
    numero: "رقم البورطابل",
    aide: "غير الأرقام الجزائرية (05، 06 ولا 07). يجيك كود فيه 6 أرقام على واتساب.",
    recevoir: "ابعثلي الكود على واتساب",
    envoi: "راهو يتبعث…",
    antiRobot: "أكّد بلي راك ماشي روبو لتحت قبل.",
    envoiImpossible: "ما قدرناش نبعثو الكود. شوف الأنترنت ديالك وعاود جرّب.",
    envoye: "الكود تبعث لـ {numero}.",
    code: "الكود (6 أرقام)",
    valider: "أكّد الكود",
    verification: "راهو يتأكّد…",
    changer: "بدّل الرقم ولا اطلب كود جديد",
    saisir: "اكتب الأرقام الستة اللي جاوك.",
    verificationImpossible: "ما قدرناش نتأكدو من الكود. شوف الأنترنت ديالك وعاود جرّب.",
  },
  commandes: {
    titre: "طلباتي",
    aucune: "ما عندك حتى طلب دابا.",
    voirArticles: "شوف السلع",
    chargementImpossible: "ما قدرناش نحمّلو طلباتك. عاود جرّب.",
    commandeImpossible: "ما قدرناش نحمّلو الطلب. عاود جرّب.",
    numero: "الطلب رقم {n}",
    statuts: { demandee: "تبعث", confirmee: "تأكّد", prete: "واجد", recuperee: "تدّا", annulee: "تلغى", expiree: "فات وقتو" },
    titresSuivi: { demandee: "الطلب تبعث", confirmee: "الحانوت أكّد الطلب", prete: "طلبك راهو واجد", recuperee: "الطلب تدّا", annulee: "الطلب تلغى", expiree: "الطلب فات وقتو" }, // « طلبك راهو واجد » validé
    motifs: { plus_en_stock: "السلعة كملت", boutique_indisponible: "الحانوت ما راهوش متوفر", client_a_annule: "الزبون لغاه", autre: "سبب آخر" },
    suivi: "تتبّع الطلب",
    aVenir: " (من بعد)",
    aRecuperer: "روح تدّيه قبل",
    motif: "السبب: {motif}",
    expiree: "الطلب ما تدّاش في 24 ساعة: يتحسب ما جيتش.",
    articles: "السلع المطلوبة",
    total: "المجموع",
    note: "الكلمة ديالك: « {note} »",
    ecrire: "اكتب للحانوت على واتساب",
    voirBoutique: "شوف الحانوت",
    mention: "الخلاص في الحانوت · تقدر تلغي الطلب ما دام ماشي واجد",
    annuler: "الغي الطلب ديالي",
    motAnnulation: "كلمة للحانوت (إذا حبيت)",
    confirmerAnnulation: "أكّد الإلغاء",
    retour: "رجوع",
  },
  retrait: {
    // US-26.2 : textes 1 à 10 de la story US-26 (darja en gras dans la story) ; les autres suivent le même style.
    bloc: "QR تاع الاستلام",
    consigne: "ورّي هاد QR للبيّاع في الحانوت. تخلّص تمّا، كاش.",
    sansCamera: "ما خدمتش الكاميرا؟ عطيه هاد الرقم تاع 6 أرقام:",
    aPayer: "تخلّص كاش",
    luminosite: "طلّع الضو تاع التيليفون باش يتقرا مليح.",
    envoyerProche: "ابعثو لواحد من دارك (واتساب)",
    copier: "كوبي الرابط",
    copie: "الرابط تكوبا.",
    copieImpossible: "ما قدرناش نكوبيو: ابعث الرابط في واتساب.",
    avertissement: "أي واحد عندو هاد الرابط يقدر يدّي الطلبية: ما تبعثوش غير لواحد تثيق فيه.",
    altQr: "QR تاع الاستلام، الطلبية رقم {n}",
    code: "رقم الاستلام",
    metaTitre: "طلبية للاستلام",
    titreProche: "الطلبية رقم {n} تدّيها من {boutique}",
    avant: "قبل {date}",
    consigneProche: "ورّي هاد QR للبيّاع، ولا عطيه الرقم تاع 6 أرقام:",
    voirBoutique: "شوف الحانوت",
    articles: "السلع اللي تدّيها",
    recuperee: "هاد الطلبية تدّات من قبل.",
    annulee: "هاد الطلبية تلغات: ما كاين والو باش تدّي.",
    expiree: "هاد الطلبية فات وقتها: ما بقاتش للاستلام.",
    invalide: "هاد الرابط ماشي صالح.",
    impossible: "ما قدرناش نجيبو الطلبية. عاود.",
  },
  noShows: {
    titre: "طلبات ما تدّاوش ({n})",
    explication: "الحانوت قال بلي ما جيتش. إذا هاد الشي غالط، اعترض في {jours} أيام: الطلب ما يتحسبش حتى تقرر BleDeal (الحساب اللي راهو مبلوكي يبقى مبلوكي حتى للقرار). اعتراض واحد في المرة.",
    enExamen: "الاعتراض راهو يتشاف",
    refusee: "الاعتراض تّرفض: الطلب يتحسب",
    votreMotif: "السبب ديالك: {motif}",
    delaiDepasse: "فات وقت الاعتراض ({jours} أيام).",
    attendre: "تقدر تعترض على هادي كي تجاوبك BleDeal على الاعتراض اللي راهو يتشاف.",
    contester: "اعترض", // validé
    pourquoi: "علاش راك تعترض؟",
    envoi: "راهو يتبعث…",
    envoyer: "ابعث الاعتراض",
    fermer: "سكّر",
  },
  carteBoutiques: {
    // US-24.3 : textes de la carte proposés dans US-24 (gardés tels quels, relecture du propriétaire à venir).
    metaTitre: "خريطة الحوانت",
    titre: "الحوانت في الخريطة", // 2
    nombreUn: "{n} حانوت في {ville}",
    nombre: "{n} حانوت في {ville}",
    filtre: "اختار القسم",
    tous: "الكل", // 11
    univers: { femme: "نسا", homme: "رجال", enfant: "ذراري", beaute: "تجميل" }, // 11
    autourDeMoi: "قريب ليّا", // 3
    autourActif: "قريب ليّا · مفعّل",
    recherche: "راهو يقلّب على البلاصة نتاعك…",
    confidentialite: "البلاصة نتاعك تبقى في التيليفون نتاعك: ما تتبعثش وما تتسجّلش.", // 4
    refus: "ما عطيتش الإذن بالموقع: القائمة تبقى مرتّبة بالاسم.", // 10
    introuvable: "ما لقيناش البلاصة نتاعك دابا. عاود جرّب برّا ولا قريب من طاقة.",
    reessayer: "عاود جرّب",
    region: "خريطة حوانت {deVille}",
    vous: "أنت",
    indisponible: "الخريطة ما قدرتش تبان. قائمة الحوانت راهي لتحت.",
    promosUne: "{n} تخفيض دابا",
    promos: "{n} تخفيضات دابا", // 5
    aucunePromo: "ما كاين حتى تخفيض دابا",
    distance: "على بعد {d}", // 8
    voirBoutique: "شوف الحانوت", // 6
    itineraire: "الطريق", // 7
    fermer: "سكّر",
    listeParNom: "الحوانت · بالاسم",
    listeProches: "الحوانت · الأقرب هوما الأولين",
    listeMieuxNotees: "الحوانت · الأحسن في النقاط هوما الأولين",
    mieuxNotees: "الأحسن في النقاط",
    sansPosition: "ما عندهمش بلاصة في الخريطة ({n})", // 9
    aucuneUnivers: "ما كاين حتى حانوت في هاد القسم دابا.",
    voirToutes: "شوف كل الحوانت",
    aucune: "ما كاين حتى حانوت في الخريطة دابا.",
    erreur: "ما قدرناش نحمّلو الحوانت. عاود جرّب.",
    accueilTitre: "الحوانت في الخريطة", // 12
    accueilTexte: "لقى التخفيضات قريب منك.",
    accueilLien: "شوف الخريطة", // 12
  },
  parrainage: {
    // US-27 : n° 1 à 4, 6 à 12 et 14 validés par le propriétaire (9/10) ; 5, 13, 15 à 24 et les autres textes : à relire.
    metaTitre: "العرضة",
    etiquette: "العرضة",
    titre: "عرّض صحابك", // 1
    intro: "عرّف صحابك بالتخفيضات تاع حوانيت مدينتك. كي صاحبك يدّي أول طلب من الحانوت، كل واحد فيكم يربح بون تاع 300 دج.",
    commentCaMarche: "كيفاش تخدم",
    etape1: "ابعث الرابط نتاعك لصحابك على واتساب.", // 2
    etape2: "صاحبك يتسجّل بنمرتو ويكتب نمرتك ولا الكود نتاعك.", // 3
    etape3: "كي يدّي أول طلب من الحانوت، تربحو بجوج.", // 4
    recompense: "بون تاع 300 دج لكل واحد، ينقص من الخلاص في الحانوت.", // 5
    tonCode: "الكود نتاعك",
    partagerWhatsApp: "ابعث على واتساب", // 6
    copierLien: "انسخ الرابط", // 7
    lienCopie: "الرابط تنسخ.",
    copieImpossible: "ما قدرناش ننسخو: ابعث الرابط على واتساب.",
    qrAlt: "QR تاع رابط العرضة نتاعك",
    qrTexte: "صاحبك يقدر يسكاني هاد QR بالتيليفون نتاعو. الرابط ما يبيّنش لا اسمك لا نمرتك.",
    connecteToi: "ادخل لحسابك باش تاخذ الرابط نتاعك",
    seConnecter: "ادخل",
    reserveClients: "العرضة غير للزبائن اللي نمرة الواتساب نتاعهم مأكّدة بالكود.",
    ferme: "العرضة مازال ما تحلّتش. ارجع من بعد!",
    bonTitre: "البون نتاعك تاع 300 دج",
    bonTexte: "في السلة، علّم على « خدم بالبون نتاعي »: تخلّص 300 دج أقل في الحانوت. BleDeal هي اللي تخلّص هاد 300 دج للحانوت.",
    voirMesBons: "شوف البونات نتاعي واللي عرضتهم",
    reglesTitre: "القواعد",
    regle1: "اللي عرض واللي تعرض، كل واحد نمرتو مأكّدة بكود الواتساب.",
    regle2: "ما تعرضش روحك. حساب واحد، واحد برك اللي عرضو.",
    regle3: "اللي تعرض يكتب اللي عرضو في 7 أيام، قبل أول طلب.",
    regle4: "البونات يجيو من بعد أول طلب تاع 2000 دج وفوق، يدّيه بالـ QR نتاعو، ماشي كي يتسجّل.",
    regle5: "البون صالح 60 يوم، واحد في كل طلب، من 1000 دج وفوق.",
    regle6: "5 صحاب في الشهر على الأكثر.",
    regle7: "BleDeal ما تكتب لحتى واحد من صحابك: انت اللي تبعث.",
    invite: "صاحبك عرضك لـ BleDeal", // 12
    inviteConnexion: "ادخل بنمرة الواتساب نتاعك، ومن بعد أكّد الكود تاع صاحبك.",
    tonParrain: "اللي عرضك",
    champ: "اللي عرضك (إلا حبيت): النمرة نتاع الواتساب ولا الكود", // 8
    rappel: "البون نتاعك ونتاع اللي عرضك يجيو من بعد أول طلب تاع 2000 دج وفوق، تدّيه من الحانوت بالـ QR نتاعك.", // 24
    valider: "أكّد",
    envoi: "راه يتبعث…",
    enregistre: "تسجّلت. إلا كانت هاد النمرة نتاع زبون في BleDeal، يولّي هو اللي عرضك من بعد أول طلب تدّيه من الحانوت.", // 9
    impossible: "ما قدرناش نسجّلو اللي عرضك. عاود جرّب.",
    parrainEnregistre: "اللي عرضك تسجّل",
    modifier: "بدّل",
    modificationsRestantes: "تقدر تبدّلو {n} مرات، قبل أول طلب.",
    monParrainage: "العرضة نتاعي",
    valides: "صحاب دّاو أول طلب", // 11
    valideUn: "صاحب دّا أول طلب",
    enAttente: "مازال ما دّاو أول طلب", // 11
    filleul: "{prenom} · {date}",
    bonFilleul: "بون تاع 300 دج",
    bonEnFile: "البون يستنّى (الميزانية)",
    plafond: "وصلت للحد تاع الشهر: 5 صحاب. اللي يجيو من بعد ياخذو البون نتاعهم، انت لا، حتى يكمل الشهر.",
    discretion: "الصحاب اللي مازال ما يبانوش بأسماءهم. حتى نمرة ما تبان.",
    aucunFilleul: "حتى صاحب مازال ما ربح: ابعث الرابط نتاعك.",
    commentMarche: "كيفاش تخدم العرضة؟",
    mesBons: "البونات نتاعي", // 15
    nomBon: "بون العرضة",
    disponible: "واجد · صالح حتى {date}", // 16
    reserve: "محجوز للطلب رقم {n}", // 21
    utilise: "تخدم نهار {date} عند {boutique}", // 22
    expire: "فات وقتو نهار {date}", // 23
    enFile: "البون نتاعك يجيك نهار {date} (الميزانية تاع الشهر كملت).", // 20
    annule: "تلغى",
    aideBons: "تخدم بيهم في السلة.", // à valider
    aideBonBleDeal: "{nom}: {montant} أقل، تخلّصو BleDeal.", // à valider
    aideBonInscription: "{nom}: {montant} أقل، تخلّصو BleDeal والحانوت اللي تسجّلت فيه.", // à valider
    accueilTitre: "عرّض صحابك", // 13
    accueilTexte: "300 دج لكل واحد", // 13
    accueilLien: "شوف",
    merciTitre: "يعطيك الصحة!", // 14
    merciTexte: "عرّف صاحبك بـ BleDeal: 300 دج لكل واحد من بعد أول طلب نتاعو.", // 14
    partagerMonLien: "ابعث الرابط نتاعي",
    utiliserBon: "خدم بالبون نتاعي (−{montant})", // 17
    ligneBon: "بون العرضة",
    aPayerBoutique: "تخلّص في الحانوت", // 18
    sousMinimum: "البون يخدم من 1000 دج وفوق.", // 19
    noteBon: "بون واحد في كل طلب. إلا الطلب تلغى ولا فات وقتو، البون يرجعلك.",
    // US-33.2 : textes de la conception (module 19, n° 2, 9, 10) ; noteBonProgramme : nouveau, à valider.
    nomBienvenue: "بون مرحبا", // 2
    nomProgramme: "بون {nom}", // 5, 9
    detailProgramme: "{montant} كي تشري {minimum} ولا كثر · حتى {date}", // 2
    utiliserBonBienvenue: "استعمل بون مرحبا (−{montant})", // 9
    utiliserBonProgramme: "استعمل بون {nom} (−{montant})", // 9
    minimumProgramme: "كي تشري {minimum} ولا كثر", // 10
    noteBonProgramme: "بون واحد في كل طلب. إلا الحانوت لغات الطلب، البون يرجعلك؛ إلا لغيتو نتا ولا ما جيتش، البون يروح.", // à valider
    // US-33.3 : n° 3 à 8, 10 à 14 de la conception ; les autres sont nouveaux, à valider.
    jaiUnCode: "عندي كود", // 3
    ajouterCode: "زيد", // 4
    codeAjoute: "بون {nom} تزاد : {montant} كي تشري {minimum} ولا كثر.", // 5
    codeInconnu: "هاد الكود ما كاينش ولا فات الوقت نتاعو.", // 6
    codeDeja: "ديجا خذيت هاد البون.", // 7
    codeTrop: "بزاف تاع المحاولات. عاود من بعد ساعة.", // 8
    codeNumero: "أكّد النمرة نتاعك باش تزيد كود.", // à valider
    codeErreur: "ما قدرناش نزيدو هاد الكود. عاود جرّب.", // à valider
    raisonUnivers: "غير سلعة {univers}", // 11
    raisonVille: "ماشي في هاد المدينة", // 12
    raisonPlafond: "هاد البون ما بقاش يتقبل في هاد الحانوت لهاد البروموسيون.", // 13
    raisonBoutique: "هاد الحانوت ما بقاش ياخذ البونات", // à valider
    // US-31.4 : nouveaux, à valider.
    raisonPasAujourdhui: "في هاد الحانوت، من غدوة", // à valider
    detailInscription: "عند {boutique} : من {date}. في حوانت أخرين : دروك.", // à valider
    universBon: { femme: "النسا", homme: "الرجال", enfant: "الذراري", beaute: "التجميل" }, // « النسا » : n° 11 ; autres à valider
    bandeau: "{nom} : {montant} هدية كي تشري {minimum} ولا كثر بالكود {code}، حتى {date}.", // 14
    bandeauSansDate: "{nom} : {montant} هدية كي تشري {minimum} ولا كثر بالكود {code}.",
    conditionsCampagne: "الشروط", // 14
    conditionsTitre: "شروط بون {nom}", // à valider
    conditionsCode: "الكود : {code}", // à valider
    conditionsMontant: "{montant} هدية كي تشري {minimum} ولا كثر",
    conditionsVilles: "المدن : {villes}", // à valider
    conditionsToutesVilles: "في كامل المدن المفتوحة", // à valider
    conditionsDates: "من {debut} حتى {fin}", // à valider
    conditionsDepuis: "من {debut}", // à valider
    conditionsNumero: "مرة وحدة لكل نمرة مأكّدة.", // à valider
    conditionsQr: "لازم QR code باش تدّي من الحانوت.", // à valider
    conditionsAucune: "هاد البروموسيون ما كاينش ولا فات الوقت نتاعو.", // à valider
    bonNonApplique: {
      aucun_bon: "البون ما تحسبش: فات وقتو ولا ما بقاش. الطلب يبقى بالسومة الكاملة؛ تقدر تلغيه إلا حبيت.",
      minimum: "البون ما تحسبش: يخدم من 1000 دج وفوق. الطلب يبقى بالسومة الكاملة.",
      boutique_exclue: "البون ما تحسبش: هاد الحانوت ما يقبلش البونات دروك. الطلب يبقى بالسومة الكاملة؛ تقدر تلغيه إلا حبيت.",
      univers: "البون ما تحسبش: يخدم غير على شي سلعة. الطلب يبقى بالسومة الكاملة؛ تقدر تلغيه إلا حبيت.", // à valider
      ville: "البون ما تحسبش: ماشي في هاد المدينة. الطلب يبقى بالسومة الكاملة؛ تقدر تلغيه إلا حبيت.", // à valider
      plafond_boutique: "البون ما تحسبش: هاد البون ما بقاش يتقبل في هاد الحانوت لهاد البروموسيون. الطلب يبقى بالسومة الكاملة؛ تقدر تلغيه إلا حبيت.", // à valider
      pas_aujourdhui: "البون ما تحسبش: في الحانوت اللي تسجلت فيه، بون مرحبا يخدم من غدوة. الطلب يبقى بالسومة الكاملة؛ تقدر تلغيه إلا حبيت.", // à valider
      erreur: "البون ما تحسبش. الطلب يبقى بالسومة الكاملة؛ تقدر تلغيه إلا حبيت.",
    },
  },
  juridique: {
    piedDePage: "معلومات قانونية",
    conditions: "الشروط",
    commercants: "التجار",
    confidentialite: "الخصوصية",
    titres: {
      conditions: "شروط الاستعمال",
      conditions_commercants: "شروط التجار",
      confidentialite: "سياسة الخصوصية",
    },
    version: "النسخة تاع {date}",
    provisoire: "نسخة مؤقتة، راهي في المراجعة القانونية.",
    traductionAttente: "الترجمة بالعربية تاع هاد النص جاية قريب. النص اللي تحت هو النسخة بالفرنسية.",
    caseInscription: "نقبل شروط الاستعمال وسياسة الخصوصية، حتى استعمال شركات برّا الدزاير (Supabase، Vercel، WhatsApp…).",
    caseRequise: "علّم على الخانة باش تدير الحساب نتاعك.",
    conditionsChangees: "الشروط نتاعنا تبدلو نهار {date}",
    accepterCommander: "نقبل ونطلب",
  },
  avis: {
    donner: "قول رايك",
    titre: "رايك في {boutique}",
    commande: "الطلب رقم {n}",
    note: "النقطة نتاعك",
    noteObligatoire: "النقطة لازم",
    etoiles: "{n} من 5",
    criteres: { accueil: "استقبال مليح", article_conforme: "السلعة كيما في الصورة", rapidite: "زربان" },
    commentaire: "كلمة (ماشي لازم)",
    compteur: "{n}/300",
    rappel: "رايك يبان للناس بإسمك والحرف الأول من لقبك.",
    publier: "انشر رايي",
    merci: "يعطيك الصحة، رايك تنشر.",
    noteRequise: "اختار نقطة من 1 حتى 5 نجوم.",
    donne: "عطيت رايك · ★ {note}",
    plusPossible: "تقدر تعطي رايك غير على طلب ديتو بالـ QR code نتاعك، في 14 يوم.",
    retourCommande: "رجوع للطلب",
    impossible: "ما قدرناش ننشرو رايك. عاود جرّب.",
    mentionBon: "الكليان ياخذو بون صغير على كل راي، مهما كانت النقطة.", // 11 (US-32.5)
    resume: "★ {note} · {n} راي",
    resumeFiche: "★ {note} ({n} راي)",
    pasAssez: "مازال ما كاينش بزاف تاع الآراء",
    titreSection: "آراء الكليان",
    noteSur: "{n} نجوم من 5",
    reponseBoutique: "رد الحانوت: {reponse}",
    voirTous: "شوف كامل الآراء",
    tousLesAvis: "الآراء على {boutique}",
    aucun: "مازال ما كاين حتى راي.",
    precedents: "آراء جداد",
    suivants: "آراء قدام",
    retourBoutique: "رجوع للحانوت",
    chargementImpossible: "ما قدرناش نحمّلو الآراء. عاود جرّب.",
    // US-32.4 : بلّغ على راي (النص 12 من الوحدة 18 ؛ الباقي : ترجمة لازم يصادق عليها المالك).
    signaler: "بلّغ",
    signalerTitre: "بلّغ على راي {auteur}",
    motifSignalement: "علاش تبلّغ؟",
    choisirMotif: "اختار السبب",
    motifs: { faux_avis: "راي ماشي صحيح", insulte: "سبّ ولا كلام ماشي لايق", informations_personnelles: "معلومات شخصية", autre: "سبب آخر" },
    commentaireSignalement: "تعليق (إذا حبيت)",
    envoyerSignalement: "ابعث البلاغ",
    envoiSignalement: "راهو يتبعث…",
    motifObligatoire: "اختار السبب.",
    signalementEchec: "البلاغ ما تبعثش. عاود جرّب.",
  },
};
