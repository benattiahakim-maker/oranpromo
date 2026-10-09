import { describe, expect, it } from "vitest";
import { MESSAGES_FIXES_TRADUITS, traduireErreurs, traduireMessage } from "./messages";
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
    expect(traduireMessage(messageNoShows(1, true), "ar")).toBe("حسابك مبلوكي: ما تقدرش تطلب. اتصل بـ OranPromo باش يحلّوه.");
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
