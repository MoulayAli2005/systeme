/**
 * Answers for the public marketing chatbot. No tenant data — only product
 * facts a visitor on the homepage is allowed to hear.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

const PRODUCT_FACTS = `
Nexora is a multi-tenant cash-on-delivery (COD) operations platform for e-commerce teams, especially in Morocco and MENA.
It covers: order confirmation (WhatsApp/call center), carrier dispatch, tracking, returns, COD remittance matching, inventory, automations, analytics and a workspace AI copilot.
Stack: Next.js, PostgreSQL, Redis, BullMQ. Integrations: Shopify, WooCommerce, YouCan, WhatsApp (Twilio), Ozon Express, Ameex, Aramex.
Pricing: Free, Starter, Pro, Business, Enterprise — see /pricing. 7-day sandbox, no card required.
Demo login after seed: amine@atlasatelier.ma / demo1234 (Atlas Atelier owner). A second tenant exists (Casa Home) so isolation can be shown.
The in-app assistant is named Noor and answers in French, Arabic, English and Darija.
`.trim();

function languageOf(text: string): "ar" | "fr" | "en" {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (
    /\b(bonjour|salut|comment|commande|livraison|c'est|quoi|prix|connecter|merci|oui|non)\b/i.test(
      text,
    )
  ) {
    return "fr";
  }
  return "en";
}

/** Pure FAQ matcher so it can be unit tested without OpenAI or a database. */
export function publicReply(question: string): { answer: string; provider: "faq" } {
  const q = question.toLowerCase();
  const lang = languageOf(question);

  if (/prix|tarif|pricing|price|abo|plan|اشتراك|سعر/.test(q)) {
    return {
      provider: "faq",
      answer:
        lang === "ar"
          ? "فيه خطط Free, Starter, Pro, Business و Enterprise. تقدر تجرب 7 أيام بلا بطاقة من /pricing أو تسجّل مباشرة."
          : lang === "fr"
            ? "Les plans vont de Free à Enterprise. 7 jours de sandbox sans carte — ouvrez /pricing, ou créez un compte sur /signup."
            : "Plans run from Free to Enterprise. There's a 7-day sandbox with no card — see /pricing, or create a workspace on /signup.",
    };
  }

  if (/login|connexion|connecter|demo|démo|compte|password|mot de passe|دخول|حساب/.test(q)) {
    return {
      provider: "faq",
      answer:
        lang === "ar"
          ? "ادخل من /login. حساب الديمو: amine@atlasatelier.ma — بعد الـ seed يظهر الباسورد في README."
          : lang === "fr"
            ? "Connectez-vous sur /login. Compte démo Atlas Atelier : amine@atlasatelier.ma — le mot de passe est dans le README après le seed (demo1234)."
            : "Sign in at /login. Demo owner: amine@atlasatelier.ma — password is in the README after seed (demo1234).",
    };
  }

  if (/\b(transporteur|carrier|ozon|ameex|aramex|livreur|شحن|ناقل)\b/.test(q)) {
    return {
      provider: "faq",
      answer:
        lang === "ar"
          ? "Nexora يتعامل مع Ozon Express و Ameex و Aramex و أي API عام. الكتالوج حسب المدينة، والتتبع يحدّث الحالة تلقائياً."
          : lang === "fr"
            ? "Ozon Express, Ameex, Aramex, plus un adaptateur HTTP générique. La grille tarifaire est par ville ; le tracking met à jour la commande tout seul."
            : "Ozon Express, Ameex, Aramex, plus a generic HTTP carrier. Rates are per city; tracking updates the order without anyone clicking.",
    };
  }

  if (/\b(whatsapp|confirmation|call center|appel|تأكيد|واتساب)\b/.test(q)) {
    return {
      provider: "faq",
      answer:
        lang === "ar"
          ? "التأكيد يقدر يكون واتساب أو مركز اتصال. الرسائل تتصيفط مع المبلغ والمدينة، والعامل يشوف نفس الطلب."
          : lang === "fr"
            ? "La confirmation passe par WhatsApp ou le centre d'appels. Le message contient déjà le COD et la ville ; l'agent voit la même commande."
            : "Confirmation runs over WhatsApp or the call desk. The message already has the COD amount and city; the agent sees the same order.",
    };
  }

  if (/\b(cod|encaiss|remittance|versement|paiement|دفع عند الاستلام)\b/.test(q)) {
    return {
      provider: "faq",
      answer:
        lang === "ar"
          ? "بعد التسليم، الناقل يحوّل الفلوس على دفعة. Nexora يطابق الكشف مع الـ AWB ويبان الفرق لكل طلب."
          : lang === "fr"
            ? "Après livraison, le transporteur reverse le cash par lot. Nexora rapproche le relevé aux AWB et montre l'écart commande par commande."
            : "After delivery the carrier remits cash in a batch. Nexora matches the statement to AWBs and shows the variance per order.",
    };
  }

  return {
    provider: "faq",
    answer:
      lang === "ar"
        ? "Nexora منصة تشغيل للتجارة بالدفع عند الاستلام: تأكيد، شحن، مرتجعات، وتحصيل. تقدر تفتح الديمو من /signup أو تسألني على الأسعار أو الناقلين."
        : lang === "fr"
          ? "Nexora est l'OS des équipes COD : confirmation WhatsApp, dispatch transporteur, retours et rapprochement des encaissements. Ouvrez /signup pour la démo, ou demandez-moi les tarifs, les transporteurs, la connexion."
          : "Nexora is the operating system for COD teams: WhatsApp confirmation, carrier dispatch, returns and payout matching. Open /signup for the demo, or ask me about pricing, carriers or how to sign in.",
  };
}

export function publicSystemPrompt() {
  return `You are Noor, Nexora's public site assistant. Be concise (max 80 words). Answer in the visitor's language (French, Arabic, Darija or English). Never invent tenant data, never claim an order was created. If asked to log in, point to /login. Product facts:\n${PRODUCT_FACTS}`;
}

export function lastUserMessage(messages: ChatTurn[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i].content;
  }
  return "";
}
