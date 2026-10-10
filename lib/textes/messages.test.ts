import { describe, expect, it } from "vitest";
import { avecMarque, MESSAGES_FIXES_TRADUITS, traduireErreurs, traduireMessage } from "./messages";
import { messageNoShows, erreurMotifContestation } from "@/lib/clients";
import { MESSAGE_CODE_INCORRECT, MESSAGE_CODE_ENVOYE, messageErreurAuth } from "@/lib/codes-telephone";
import { MESSAGE_TELEPHONE_INVALIDE } from "@/lib/telephone";
import { ErreurAutreBoutique } from "@/lib/panier";

describe("US-23 : messages du serveur et de la base en arabe", () => {
  it("texte validé n° 8 repris tel quel", () => {
    expect(traduireMessage(MESSAGE_CODE_INCORRECT, "ar")).toBe("الكود غالط ولا فات وقتو. شوف الأرقام الستة ولا اطلب كود جديد.");
  });
  it("français : message inchangé ; null reste null", () => {
    expect(traduireMessage(MESSAGE_CODE_INCORRECT, "fr")).toBe(MESSAGE_CODE_INCORRECT);
    expect(traduireMessage(null, "ar")).toBeNull();
  });
  it("apostrophes droites (base) et typographiques (lib) reconnues", () => {
    expect(traduireMessage("Il ne reste qu’une pièce dans cette taille.", "ar")).toBe("بقات غير وحدة في هاد المقاس.");
    expect(traduireMessage("Un article du panier n'est plus disponible : retirez-le et réessayez.", "ar")).toBe("سلعة في السلة ما بقاتش: نحّيها وعاود جرّب.");
  });
  it("messages des règles (lib) traduits, valeurs gardées", () => {
    expect(traduireMessage(messageNoShows(2, false), "ar")).toBe("رد بالك: 2 طلب ما تدّاش. بقاولك 3 فرص قبل ما يتبلوكا حسابك.");
    expect(traduireMessage(messageNoShows(1, false), "ar")).toBe("رد بالك: 1 طلب ما تدّاش. بقاولك 4 فرص قبل ما يتبلوكا حسابك.");
    expect(traduireMessage(messageNoShows(5, true), "ar")).toContain("حسابك تبلوكا من بعد 5");
    expect(traduireMessage(messageNoShows(1, true), "ar")).toBe("حسابك مبلوكي: ما تقدرش تطلب. اتصل بـ BleDeal باش يحلّوه.");
    expect(traduireMessage(erreurMotifContestation("x"), "ar")).toBe("قول في كلمتين علاش راك تعترض (من 5 حتى 300 حرف).");
    expect(traduireMessage(new ErreurAutreBoutique("Boutique Nour").message, "ar")).toBe("السلة فيها سلع من Boutique Nour. الطلب يكون من حانوت واحد برك.");
    expect(traduireMessage(MESSAGE_TELEPHONE_INVALIDE, "ar")).toContain("بورطابل جزائري");
    expect(traduireMessage(MESSAGE_CODE_ENVOYE, "ar")).toContain("واتساب");
    for (const code of ["captcha_failed", "phone_exists", "sms_send_failed", "over_sms_send_rate_limit", "x"]) expect(traduireMessage(messageErreurAuth({ code }, "envoi"), "ar")).not.toMatch(/[a-zé]{4,}/i);
  });
  it("erreurs de la base avec valeurs", () => {
    expect(traduireMessage("La taille XL de « Robe » n'existe plus : retirez-la du panier.", "ar")).toBe("مقاس XL تاع « Robe » ما بقاش: نحّيه من السلة.");
    expect(traduireMessage("La note pour la boutique doit faire 300 caractères au plus.", "ar")).toBe("الكلمة لازم ما تفوتش 300 حرف.");
  });
  it("erreurs par champ", () => {
    expect(traduireErreurs({ nom: "Votre nom doit contenir entre 2 et 60 caractères.", telephone: undefined }, "ar")).toEqual({ nom: "الاسم لازم يكون من 2 حتى 60 حرف.", telephone: undefined });
  });
  it("aucune traduction vide, aucune clé avec apostrophe typographique (elle ne serait jamais trouvée)", () => {
    for (const cle of MESSAGES_FIXES_TRADUITS) { expect(cle).not.toContain("’"); expect(traduireMessage(cle, "ar")).not.toBe(cle); }
  });
});

describe("US-25.1 : messages du panier pour la beauté", () => {
  it("contenance traduite par « الحجم »", () => {
    expect(traduireMessage("Cette contenance est épuisée.", "ar")).toBe("هاد الحجم ما بقاش.");
    expect(traduireMessage("Il ne reste qu’une pièce dans cette contenance.", "ar")).toBe("بقات غير وحدة في هاد الحجم.");
    expect(traduireMessage("Vous pouvez commander au plus 3 pièces dans cette contenance.", "ar")).toBe("تقدر تطلب 3 برك في هاد الحجم.");
  });
});

describe("US-25.4 : messages de la base pour les produits de beauté", () => {
  it("« contenance » traduite par « الحجم »", () => {
    expect(traduireMessage("Il ne reste que 2 pièce(s) en contenance 100 ml pour « Eau de parfum oud boisé ».", "ar")).toBe("بقاو غير 2 في الحجم 100 ml لـ « Eau de parfum oud boisé ».");
    expect(traduireMessage("La contenance 50 ml de « Eau de parfum rose et musc » n'existe plus : retirez-la du panier.", "ar")).toBe("الحجم 50 ml تاع « Eau de parfum rose et musc » ما بقاش: نحّيه من السلة.");
    expect(traduireMessage("Le même article et la même contenance apparaissent deux fois dans le panier.", "ar")).toBe("نفس السلعة بنفس الحجم كاينة جوج مرات في السلة.");
  });
  it("la mode garde « مقاس » ; en français, le message de la base est affiché tel quel", () => {
    expect(traduireMessage("Il ne reste que 1 pièce(s) en taille M pour « Polo ».", "ar")).toBe("بقاو غير 1 في مقاس M لـ « Polo ».");
    expect(traduireMessage("Le même article et la même taille apparaissent deux fois dans le panier.", "ar")).toBe("نفس السلعة بنفس المقاس كاينة جوج مرات في السلة.");
    expect(traduireMessage("Il ne reste que 2 pièce(s) en contenance 100 ml pour « Oud ».", "fr")).toBe("Il ne reste que 2 pièce(s) en contenance 100 ml pour « Oud ».");
  });
});

describe("US-30.1 : messages de la base avec « OranPromo » affichés avec « BleDeal » (base inchangée)", () => {
  const BASE = [
    "Votre compte est bloqué après 5 commandes non récupérées : contactez OranPromo pour le débloquer.",
    "Votre compte est bloqué : contactez OranPromo pour le débloquer.",
    "Votre compte est bloqué : vous ne pouvez pas changer de numéro. Contactez OranPromo.",
  ];
  it.each(BASE)("français : « %s »", message => {
    expect(traduireMessage(message, "fr")).toBe(message.replace("OranPromo", "BleDeal"));
  });
  it.each(BASE)("arabe : traduit comme avant, avec BleDeal", message => {
    const arabe = traduireMessage(message, "ar"); expect(arabe).toContain("BleDeal"); expect(arabe).not.toContain("OranPromo"); expect(arabe).not.toBe(message);
  });
  it("élision : « la réponse d'OranPromo » devient « la réponse de BleDeal »", () => {
    expect(avecMarque("Vous avez déjà une contestation en attente : attendez la réponse d'OranPromo avant d'en envoyer une autre."))
      .toBe("Vous avez déjà une contestation en attente : attendez la réponse de BleDeal avant d'en envoyer une autre.");
    expect(avecMarque("tant qu’OranPromo n’a pas décidé")).toBe("tant que BleDeal n’a pas décidé");
  });
});
