// US-23 : messages renvoyés par le serveur, les règles de lib/ et la base (erreurs, confirmations), traduits à
// l'affichage. La clé est le message français (déjà fixé et testé) ; un message sans traduction reste en français.
import type { Langue } from "@/lib/langue";

/** Apostrophes droites et typographiques confondues (la base écrit « n'existe », lib/ « n’existe »). */
const normaliser = (texte: string) => texte.replace(/’/g, "'").trim();

/**
 * US-30.1 : les messages de la base disent encore « OranPromo » (fonctions de blocage et de no-show non modifiées) :
 * le site les affiche avec « BleDeal » (« d'OranPromo » → « de BleDeal »), en français comme avant traduction.
 */
export function avecMarque(texte: string): string {
  return texte.replace(/\bd(['’])OranPromo\b/g, "de BleDeal").replace(/\bqu(['’])OranPromo\b/g, "que BleDeal").replace(/OranPromo/g, "BleDeal");
}

const FIXES: Record<string, string> = {
  // Code par WhatsApp (US-21) — n° 8 validé par le propriétaire le 9/10.
  "Code incorrect ou expiré. Vérifiez les 6 chiffres ou demandez un nouveau code.": "الكود غالط ولا فات وقتو. شوف الأرقام الستة ولا اطلب كود جديد.",
  "Code envoyé sur WhatsApp. Pas reçu ? Vérifiez le numéro, puis demandez un nouveau code dans une minute.": "الكود تبعث على واتساب. ما جاكش؟ شوف الرقم، ومن بعد دقيقة اطلب كود جديد.",
  "La connexion par téléphone n'est pas encore activée. Connectez-vous avec votre e-mail.": "الدخول بالتيليفون مازال ما تفعّلش. ادخل بالإيميل ديالك.",
  "La connexion par téléphone n'est pas encore configurée. Réessayez plus tard ou connectez-vous avec votre e-mail.": "الدخول بالتيليفون مازال ما توجدش. عاود جرّب من بعد ولا ادخل بالإيميل ديالك.",
  "Les comptes commerçant, ambassadeur et administrateur se connectent par e-mail : pas de numéro de téléphone de connexion.": "حسابات التجار والسفراء والإدارة يدخلو بالإيميل: ما كانش رقم تيليفون للدخول.",
  "Le contrôle anti-robot a échoué ou a expiré : recommencez-le, puis redemandez le code.": "التأكيد بلي راك ماشي روبو ما نجحش ولا فات وقتو: عاودو، ومن بعد اطلب الكود مرة أخرى.",
  "Ce numéro est déjà utilisé par un autre compte : connectez-vous avec ce numéro.": "هاد الرقم مستعمل في حساب آخر: ادخل بهاد الرقم.",
  "Trop de demandes : attendez quelques minutes avant de redemander un code.": "طلبات بزاف: استنّى شوية دقايق قبل ما تطلب كود آخر.",
  "Impossible d'envoyer le code sur WhatsApp. Vérifiez que ce numéro utilise WhatsApp, ou réessayez dans quelques minutes.": "ما قدرناش نبعثو الكود على واتساب. شوف بلي هاد الرقم فيه واتساب، ولا عاود جرّب من بعد شوية.",
  "Impossible d'envoyer le code. Réessayez dans quelques instants.": "ما قدرناش نبعثو الكود. عاود جرّب من بعد شوية.",
  "Impossible de vérifier le code. Réessayez dans quelques instants.": "ما قدرناش نتأكدو من الكود. عاود جرّب من بعد شوية.",
  "Saisissez les 6 chiffres du code reçu.": "اكتب الأرقام الستة اللي جاوك.",
  // US-34.2 : acceptation des conditions (n° 3 de la conception ; les autres : traduction à valider).
  "Cochez la case pour créer votre compte.": "علّم على الخانة باش تدير الحساب نتاعك.",
  "Nos conditions ont changé : acceptez-les pour commander.": "الشروط نتاعنا تبدلو: اقبلهم باش تطلب.",
  "Les conditions ont changé : rechargez la page.": "الشروط تبدلو: عاود حمّل الصفحة.",
  "Impossible de vérifier les conditions acceptées. Réessayez.": "ما قدرناش نشوفو الشروط اللي قبلتهم. عاود جرّب.",
  "Impossible d'enregistrer votre accord. Réessayez.": "ما قدرناش نسجلو الموافقة نتاعك. عاود جرّب.",
  "Ce numéro est déjà vérifié sur votre compte.": "هاد الرقم راهو مأكّد في حسابك.",
  "Saisissez un numéro de mobile algérien : 05, 06 ou 07 suivi de 8 chiffres.": "اكتب رقم بورطابل جزائري: 05، 06 ولا 07 ومن بعدها 8 أرقام.",
  "Attendez une minute avant de demander un nouveau code.": "استنّى دقيقة قبل ما تطلب كود جديد.",
  "Trop de codes demandés pour ce numéro : réessayez dans une heure.": "طلبت كودات بزاف لهاد الرقم: عاود جرّب من بعد ساعة.",
  "Numéro refusé : seuls les mobiles algériens (05, 06 ou 07) sont acceptés.": "الرقم ما تقبلش: غير البورطابل الجزائري (05، 06 ولا 07).",
  "Votre numéro est vérifié : pour en changer, vérifiez le nouveau numéro par code.": "رقمك مأكّد: باش تبدّلو، أكّد الرقم الجديد بالكود.",
  "Votre compte est bloqué : vous ne pouvez pas changer de numéro. Contactez BleDeal.": "حسابك مبلوكي: ما تقدرش تبدّل الرقم. اتصل بـ BleDeal.",
  "Vous êtes connecté.": "راك داخل لحسابك.",
  "Numéro vérifié.": "الرقم تأكّد.",
  // Connexion par e-mail
  "Saisissez une adresse e-mail valide.": "اكتب إيميل صحيح.",
  "La limite d'envoi des e-mails de connexion est atteinte. Attendez avant de demander un nouveau lien.": "وصلنا للحد تاع إيميلات الدخول. استنّى قبل ما تطلب رابط جديد.",
  "Le contrôle anti-robot a échoué ou a expiré : recommencez-le.": "التأكيد بلي راك ماشي روبو ما نجحش ولا فات وقتو: عاودو.",
  "Impossible d'envoyer le lien de connexion. Réessayez dans quelques instants.": "ما قدرناش نبعثو رابط الدخول. عاود جرّب من بعد شوية.",
  "Votre session a expiré. Reconnectez-vous.": "فات وقت الدخول ديالك. عاود ادخل.",
  // Profil
  "Vérifiez votre nom et votre numéro.": "شوف اسمك ورقمك.",
  "Vérifiez votre nom.": "شوف اسمك.",
  "Profil enregistré.": "المعلومات تسجّلت.",
  "Impossible d'enregistrer votre profil. Réessayez.": "ما قدرناش نسجّلو معلوماتك. عاود جرّب.",
  "Impossible de charger votre profil. Réessayez.": "ما قدرناش نحمّلو معلوماتك. عاود جرّب.",
  "Votre nom ne peut contenir que des lettres, des espaces, une apostrophe ou un tiret (pas de chiffres ni de lien).": "الاسم فيه غير الحروف، الفراغات، الفاصلة العليا ولا الخط (بلا أرقام وبلا روابط).",
  "Saisissez un numéro algérien valide, par exemple 0555 12 34 56.": "اكتب رقم جزائري صحيح، مثلا 0555 12 34 56.",
  "Nom invalide : lettres, espaces, apostrophe et tiret seulement (2 à 60 caractères, sans chiffres).": "الاسم ماشي صحيح: غير الحروف، الفراغات، الفاصلة العليا والخط (من 2 حتى 60 حرف، بلا أرقام).",
  "Numéro de téléphone invalide : format attendu +213XXXXXXXXX.": "رقم التيليفون ماشي صحيح: لازم يكون هكا +213XXXXXXXXX.",
  "Corrigez votre nom dans votre compte : lettres, espaces, apostrophe et tiret seulement.": "صحّح اسمك في حسابك: غير الحروف، الفراغات، الفاصلة العليا والخط.",
  "Profil introuvable : reconnectez-vous.": "ما لقيناش حسابك: عاود ادخل.",
  // Blocage et no-shows (textes affichés seulement : les règles ne changent pas)
  "Votre compte est bloqué : vous ne pouvez plus commander. Contactez BleDeal pour le débloquer.": "حسابك مبلوكي: ما تقدرش تطلب. اتصل بـ BleDeal باش يحلّوه.",
  "Votre compte est bloqué : contactez BleDeal pour le débloquer.": "حسابك مبلوكي: اتصل بـ BleDeal باش يحلّوه.",
  "Votre compte est bloqué après 5 commandes non récupérées : contactez BleDeal pour le débloquer.": "حسابك تبلوكا من بعد 5 طلبات ما تدّاوش: اتصل بـ BleDeal باش يحلّوه.",
  "Connectez-vous pour contester.": "ادخل لحسابك باش تعترض.",
  "Contestation invalide.": "الاعتراض ماشي صحيح.",
  "Contestation envoyée : BleDeal va l'examiner. En attendant, cette commande ne compte pas dans vos commandes non récupérées.": "الاعتراض تبعث: BleDeal راح تشوفو. في هاد الوقت، هاد الطلب ما يتحسبش مع الطلبات اللي ما تدّاوش.",
  "Impossible d'envoyer votre contestation. Réessayez.": "ما قدرناش نبعثو الاعتراض ديالك. عاود جرّب.",
  "Aucun no-show à contester sur cette commande.": "هاد الطلب ما فيهش غياب باش تعترض عليه.",
  "Le délai pour contester est dépassé : un no-show se conteste dans les 7 jours.": "فات وقت الاعتراض: تعترض في 7 أيام.",
  "Impossible de charger vos commandes non récupérées. Réessayez.": "ما قدرناش نحمّلو الطلبات اللي ما تدّاوش. عاود جرّب.",
  // Commandes
  "Votre panier est vide.": "السلة فارغة.",
  "Votre panier est invalide : videz-le et réessayez.": "السلة فيها مشكل: فرّغها وعاود جرّب.",
  "Connectez-vous pour commander.": "ادخل لحسابك باش تطلب.",
  "Connectez-vous pour modifier une commande.": "ادخل لحسابك باش تبدّل الطلب.",
  "Impossible d'envoyer la commande. Réessayez.": "ما قدرناش نبعثو الطلب. عاود جرّب.",
  "Impossible de modifier la commande. Réessayez.": "ما قدرناش نبدّلو الطلب. عاود جرّب.",
  "Impossible d'annuler la commande. Réessayez.": "ما قدرناش نلغيو الطلب. عاود جرّب.",
  "Impossible de charger vos commandes. Réessayez.": "ما قدرناش نحمّلو طلباتك. عاود جرّب.",
  "Commande invalide.": "الطلب ماشي صحيح.",
  "Commande annulée.": "الطلب تلغى.",
  "Commande introuvable.": "ما لقيناش الطلب.",
  "Renseignez votre nom et votre numéro de téléphone avant de commander.": "اكتب اسمك ورقم التيليفون ديالك قبل ما تطلب.",
  "Un article du panier n'est plus disponible : retirez-le et réessayez.": "سلعة في السلة ما بقاتش: نحّيها وعاود جرّب.",
  "Cet article n'est plus en ligne.": "هاد السلعة ما بقاتش في الموقع.",
  "Le même article et la même taille apparaissent deux fois dans le panier.": "نفس السلعة بنفس المقاس كاينة جوج مرات في السلة.",
  // US-25.4 : la base écrit « contenance » pour les produits de beauté.
  "Le même article et la même contenance apparaissent deux fois dans le panier.": "نفس السلعة بنفس الحجم كاينة جوج مرات في السلة.",
  "Une commande contient de 1 à 10 lignes.": "الطلب فيه من 1 حتى 10 سلع.",
  "Une ligne du panier est incomplète (article, taille ou quantité manquant) : videz le panier et réessayez.": "سطر في السلة ناقص (السلعة، المقاس ولا الكمية): فرّغ السلة وعاود جرّب.",
  "Une ligne du panier est invalide : videz le panier et réessayez.": "سطر في السلة فيه مشكل: فرّغ السلة وعاود جرّب.",
  "La quantité doit être comprise entre 1 et 10.": "الكمية لازم تكون من 1 حتى 10.",
  "Trop de commandes en une heure : réessayez plus tard.": "طلبات بزاف في ساعة: عاود جرّب من بعد.",
  "Cette boutique a reçu trop de commandes dans la dernière heure : réessayez un peu plus tard.": "هاد الحانوت جاتو طلبات بزاف في الساعة اللي فاتت: عاود جرّب من بعد شوية.",
  "Boutique introuvable.": "ما لقيناش الحانوت.",
  "Accès refusé.": "ما عندكش الحق.",
  "Demande incomplète : commande ou statut manquant.": "الطلب ناقص.",
  // Panier (navigateur)
  "Cette taille est épuisée.": "هاد المقاس ما بقاش.",
  "Il ne reste qu'une pièce dans cette taille.": "بقات غير وحدة في هاد المقاس.",
  "Cette contenance est épuisée.": "هاد الحجم ما بقاش.",
  "Il ne reste qu'une pièce dans cette contenance.": "بقات غير وحدة في هاد الحجم.",
  // Parrainage (US-27) : réponses de choisir_parrain et de l'action serveur. N° 9 et 10 validés (9/10), les autres à relire.
  "C'est noté. Si ce numéro est celui d'un client BleDeal, il deviendra ton parrain après ton premier retrait en boutique.": "تسجّلت. إلا كانت هاد النمرة نتاع زبون في BleDeal، يولّي هو اللي عرضك من بعد أول طلب تدّيه من الحانوت.",
  "C'est ton propre numéro : choisis le numéro d'un ami.": "هادي نمرتك أنت: ختار نمرة صاحبك.",
  "Écris le numéro WhatsApp de ton parrain (05, 06 ou 07 et 8 chiffres) ou son code de 6 caractères.": "اكتب نمرة الواتساب تاع اللي عرضك (05، 06 ولا 07 و8 أرقام) ولا الكود نتاعو (6 حروف).",
  "Connecte-toi pour choisir ton parrain.": "ادخل لحسابك باش تكتب اللي عرضك.",
  "Le parrainage n'est pas ouvert pour le moment.": "العرضة مازال ما تحلّتش.",
  "Le parrainage est réservé aux clients.": "العرضة غير للزبائن.",
  "Vérifie ton numéro par code avant de choisir ton parrain.": "أكّد نمرتك بالكود قبل ما تكتب اللي عرضك.",
  "Tu as déjà modifié ton parrain 2 fois : ton choix est enregistré.": "بدّلت اللي عرضك جوج مرات: الاختيار نتاعك تسجّل.",
  "Le parrain se choisit avant ta première commande.": "اللي عرضك يتكتب قبل أول طلب.",
  "Le parrain se choisit dans les 7 jours après ton inscription.": "اللي عرضك يتكتب في 7 أيام من بعد ما تسجّلت.",
  "Ton parrainage est déjà traité : il ne peut plus changer.": "العرضة نتاعك تحسبت: ما تقدرش تتبدّل.",
  "Ton numéro a déjà été parrainé : un numéro ne peut être parrainé qu'une fois.": "نمرتك تعرضت من قبل: النمرة تتعرض مرة وحدة برك.",
  "Impossible d'enregistrer ton parrain. Réessaie.": "ما قدرناش نسجّلو اللي عرضك. عاود جرّب.",
  // Signalement
  "Merci, nous allons vérifier.": "يعطيك الصحة، راح نشوفو.",
  "Choisissez un motif.": "اختار السبب.",
  "Le signalement n'a pas pu être envoyé. Réessayez.": "البلاغ ما تبعثش. عاود جرّب.",
  "Le signalement n'est pas disponible pour le moment. Réessayez plus tard.": "البلاغ ما راهوش متوفر دابا. عاود جرّب من بعد.",
  "Cet article a déjà été signalé plusieurs fois, merci. Il sera examiné rapidement.": "هاد السلعة تبلّغ عليها بزاف المرات، يعطيك الصحة. راح تتشاف قريب.",
  "Trop de signalements en ce moment, réessayez plus tard.": "بلاغات بزاف دابا، عاود جرّب من بعد.",
  "Trop de signalements envoyés : réessayez dans une heure.": "بعثت بلاغات بزاف: عاود جرّب من بعد ساعة.",
  "Le commentaire doit contenir 1000 caractères au plus.": "التعليق ما يفوتش 1000 حرف.",
  "Visiteur inconnu.": "زائر ما نعرفوهش.",
  // US-32.2 : avis (n° 7 et 8 de la conception ; les autres : traduction à valider par le propriétaire).
  "Merci, votre avis est publié.": "يعطيك الصحة، رايك تنشر.",
  "Votre commentaire ne peut pas contenir de lien, de numéro de téléphone ni de mot grossier.": "ما تقدرش تكتب لينك، ولا نمرة تيليفون، ولا كلام خايب.",
  "Un avis est possible seulement sur une commande récupérée avec votre QR code.": "تقدر تعطي رايك غير على طلب ديتو بالـ QR code نتاعك.",
  "Le délai de 14 jours pour donner votre avis est dépassé.": "فاتو 14 يوم: ما بقاش تقدر تعطي رايك على هاد الطلب.",
  "Vous avez déjà donné votre avis sur cette commande.": "راك عطيت رايك على هاد الطلب.",
  "Vous ne pouvez pas donner un avis sur votre propre boutique.": "ما تقدرش تعطي رايك على الحانوت نتاعك.",
  "Choisissez une note de 1 à 5 étoiles.": "اختار نقطة من 1 حتى 5 نجوم.",
  "Critère inconnu.": "هاد الاختيار ما كاينش.",
  "Le commentaire doit contenir 300 caractères au plus.": "الكلمة لازم ما تفوتش 300 حرف.",
  "Impossible de publier votre avis. Réessayez.": "ما قدرناش ننشرو رايك. عاود جرّب.",
  "Connectez-vous pour donner votre avis.": "ادخل لحسابك باش تعطي رايك.",
};

/** Messages avec des valeurs (nombres, noms) : expression du message français → modèle arabe ($1, $2…). */
const MODELES: [RegExp, string][] = [
  [/^Votre panier contient déjà des articles de (.+)\. Une commande ne concerne qu'une boutique\.$/, "السلة فيها سلع من $1. الطلب يكون من حانوت واحد برك."],
  [/^Choisissez une quantité entre 1 et (\d+)\.$/, "اختار كمية من 1 حتى $1."],
  [/^Vous pouvez commander au plus (\d+) pièces dans cette taille\.$/, "تقدر تطلب $1 برك في هاد المقاس."],
  [/^Vous pouvez commander au plus (\d+) pièces dans cette contenance\.$/, "تقدر تطلب $1 برك في هاد الحجم."],
  [/^Un panier contient au plus (\d+) articles différents\.$/, "السلة فيها $1 سلع مختلفة على الأكثر."],
  [/^Votre compte est bloqué après (\d+) commandes non récupérées : vous ne pouvez plus commander\. Contactez BleDeal pour le débloquer\.$/, "حسابك تبلوكا من بعد $1 طلبات ما تدّاوش: ما تقدرش تطلب. اتصل بـ BleDeal باش يحلّوه."],
  [/^Attention : (\d+) commandes? non récupérées?\. Il vous reste (\d+) essais? avant le blocage de votre compte\.$/, "رد بالك: $1 طلب ما تدّاش. بقاولك $2 فرص قبل ما يتبلوكا حسابك."],
  [/^Votre nom doit contenir entre 2 et (\d+) caractères\.$/, "الاسم لازم يكون من 2 حتى $1 حرف."],
  [/^Expliquez en quelques mots pourquoi vous contestez \((\d+) à (\d+) caractères\)\.$/, "قول في كلمتين علاش راك تعترض (من $1 حتى $2 حرف)."],
  [/^La note (?:pour la boutique )?doit faire (\d+) caractères au plus\.$/, "الكلمة لازم ما تفوتش $1 حرف."],
  [/^Il ne reste que (\d+) pièce\(s\) en taille (.+) pour « (.+) »\.$/, "بقاو غير $1 في مقاس $2 لـ « $3 »."],
  [/^La taille (.+) de « (.+) » n'existe plus : retirez-la du panier\.$/, "مقاس $1 تاع « $2 » ما بقاش: نحّيه من السلة."],
  // US-25.4 : produits de beauté (« 100 ml » reste tel quel dans le message).
  [/^Il ne reste que (\d+) pièce\(s\) en contenance (.+) pour « (.+) »\.$/, "بقاو غير $1 في الحجم $2 لـ « $3 »."],
  [/^La contenance (.+) de « (.+) » n'existe plus : retirez-la du panier\.$/, "الحجم $1 تاع « $2 » ما بقاش: نحّيه من السلة."],
  [/^Changement de statut impossible : la commande est déjà « (.+) »\.$/, "ما نقدروش نبدّلو الطلب: راهو « $1 »."],
];

/** Message dans la langue choisie ; un message inconnu reste en français. */
export function traduireMessage(message: string, langue: Langue): string;
export function traduireMessage(message: string | null | undefined, langue: Langue): string | null;
export function traduireMessage(message: string | null | undefined, langue: Langue): string | null {
  if (message == null) return null;
  message = avecMarque(message);
  if (langue !== "ar") return message;
  const cle = normaliser(message);
  const fixe = FIXES[cle];
  if (fixe) return fixe;
  for (const [modele, arabe] of MODELES) if (modele.test(cle)) return cle.replace(modele, arabe);
  return message;
}

/** Erreurs par champ (formulaire de profil) dans la langue choisie. */
export function traduireErreurs<T extends Record<string, string | undefined>>(erreurs: T, langue: Langue): T {
  return Object.fromEntries(Object.entries(erreurs).map(([champ, texte]) => [champ, texte === undefined ? texte : traduireMessage(texte, langue)])) as T;
}

/** Pour les tests : tous les messages fixes connus. */
export const MESSAGES_FIXES_TRADUITS = Object.keys(FIXES);
