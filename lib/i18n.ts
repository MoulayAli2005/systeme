export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "nexora_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function directionOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export type LocaleMeta = {
  code: Locale;
  native: string;
  english: string;
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  fr: { code: "fr", native: "Français", english: "French" },
  en: { code: "en", native: "English", english: "English" },
  ar: { code: "ar", native: "العربية", english: "Arabic" },
};

type Dict = {
  language: string;
  nav: {
    product: string;
    inbox: string;
    pricing: string;
    integrations: string;
    signIn: string;
    openDemo: string;
  };
  app: {
    dashboard: string;
    orders: string;
    pipeline: string;
    customers: string;
    callCenter: string;
    inbox: string;
    shipments: string;
    returns: string;
    products: string;
    inventory: string;
    marketing: string;
    automations: string;
    ai: string;
    analytics: string;
    team: string;
    tasks: string;
    integrations: string;
    settings: string;
    search: string;
    signOut: string;
    opening: string;
  };
  chat: {
    ask: string;
    minimize: string;
    close: string;
    send: string;
    writing: string;
    siteIntro: string;
    opsIntro: string;
    placeholderSite: string;
    placeholderOps: string;
    needLogin: string;
    unavailable: string;
    sitePrompts: [string, string, string];
    opsPrompts: [string, string, string];
  };
  login: {
    title: string;
    hint: string;
    email: string;
    password: string;
    totp: string;
    totpRequired: string;
    submit: string;
    pending: string;
    failed: string;
    newHere: string;
    create: string;
  };
};

export const DICTIONARIES: Record<Locale, Dict> = {
  fr: {
    language: "Langue",
    nav: {
      product: "Produit",
      inbox: "Messagerie",
      pricing: "Tarifs",
      integrations: "Intégrations",
      signIn: "Connexion",
      openDemo: "Ouvrir la démo",
    },
    app: {
      dashboard: "Tableau de bord",
      orders: "Commandes",
      pipeline: "Pipeline",
      customers: "Clients",
      callCenter: "Centre d'appels",
      inbox: "Messagerie",
      shipments: "Expéditions",
      returns: "Retours",
      products: "Produits",
      inventory: "Stock",
      marketing: "Marketing",
      automations: "Automatisations",
      ai: "IA",
      analytics: "Analyses",
      team: "Équipe",
      tasks: "Tâches",
      integrations: "Intégrations",
      settings: "Paramètres",
      search: "Rechercher commandes, clients, SKU…",
      signOut: "Se déconnecter",
      opening: "Ouverture de l'espace…",
    },
    chat: {
      ask: "Demander à Noor",
      minimize: "Réduire",
      close: "Fermer",
      send: "Envoyer",
      writing: "Noor écrit…",
      siteIntro:
        "Je suis Noor. Je peux vous expliquer Nexora, les tarifs, les transporteurs, ou comment ouvrir la démo.",
      opsIntro:
        "Je lis les 7 derniers jours de votre workspace. Demandez un taux de livraison, une ville, un n° NX-… ou un AWB.",
      placeholderSite: "Posez une question…",
      placeholderOps: "NX-11546, une ville, le profit…",
      needLogin: "Connectez-vous pour que je lise vos commandes — ou restez ici, je peux parler produit.",
      unavailable: "Le chatbot est indisponible.",
      sitePrompts: ["C'est quoi Nexora ?", "Comment me connecter ?", "Quels transporteurs ?"],
      opsPrompts: [
        "Combien de livraisons cette semaine ?",
        "Quelle ville livre le moins bien ?",
        "Où en est le profit ?",
      ],
    },
    login: {
      title: "Bon retour.",
      hint: "Compte démo : amine@atlasatelier.ma / demo1234",
      email: "Email",
      password: "Mot de passe",
      totp: "Code authenticator",
      totpRequired: "Entrez votre code authenticator.",
      submit: "Se connecter",
      pending: "Connexion…",
      failed: "Connexion impossible",
      newHere: "Nouveau ?",
      create: "Créer un espace",
    },
  },
  en: {
    language: "Language",
    nav: {
      product: "Product",
      inbox: "Inbox",
      pricing: "Pricing",
      integrations: "Integrations",
      signIn: "Sign in",
      openDemo: "Open demo",
    },
    app: {
      dashboard: "Dashboard",
      orders: "Orders",
      pipeline: "Pipeline",
      customers: "Customers",
      callCenter: "Call center",
      inbox: "Inbox",
      shipments: "Shipments",
      returns: "Returns",
      products: "Products",
      inventory: "Inventory",
      marketing: "Marketing",
      automations: "Automations",
      ai: "AI",
      analytics: "Analytics",
      team: "Team",
      tasks: "Tasks",
      integrations: "Integrations",
      settings: "Settings",
      search: "Search orders, customers, SKUs…",
      signOut: "Sign out",
      opening: "Opening workspace…",
    },
    chat: {
      ask: "Ask Noor",
      minimize: "Minimize",
      close: "Close",
      send: "Send",
      writing: "Noor is typing…",
      siteIntro: "I'm Noor. I can explain Nexora, pricing, carriers, or how to open the demo.",
      opsIntro:
        "I read the last 7 days of your workspace. Ask about a delivery rate, a city, an NX- number or an AWB.",
      placeholderSite: "Ask a question…",
      placeholderOps: "NX-11546, a city, profit…",
      needLogin: "Sign in so I can read your orders — or stay here and ask about the product.",
      unavailable: "The chatbot is unavailable.",
      sitePrompts: ["What is Nexora?", "How do I sign in?", "Which carriers?"],
      opsPrompts: ["How many deliveries this week?", "Which city delivers worst?", "Where is profit?"],
    },
    login: {
      title: "Welcome back.",
      hint: "Demo owner: amine@atlasatelier.ma / demo1234",
      email: "Email",
      password: "Password",
      totp: "Authenticator code",
      totpRequired: "Enter your authenticator code.",
      submit: "Sign in",
      pending: "Signing in…",
      failed: "Sign in failed",
      newHere: "New here?",
      create: "Create a workspace",
    },
  },
  ar: {
    language: "اللغة",
    nav: {
      product: "المنتج",
      inbox: "الرسائل",
      pricing: "الأسعار",
      integrations: "التكاملات",
      signIn: "دخول",
      openDemo: "فتح العرض",
    },
    app: {
      dashboard: "لوحة القيادة",
      orders: "الطلبات",
      pipeline: "المسار",
      customers: "العملاء",
      callCenter: "مركز الاتصال",
      inbox: "الرسائل",
      shipments: "الشحنات",
      returns: "المرتجعات",
      products: "المنتجات",
      inventory: "المخزون",
      marketing: "التسويق",
      automations: "الأتمتة",
      ai: "الذكاء الاصطناعي",
      analytics: "التحليلات",
      team: "الفريق",
      tasks: "المهام",
      integrations: "التكاملات",
      settings: "الإعدادات",
      search: "ابحث عن الطلبات والعملاء والمنتجات…",
      signOut: "تسجيل الخروج",
      opening: "جارٍ فتح مساحة العمل…",
    },
    chat: {
      ask: "اسأل نور",
      minimize: "تصغير",
      close: "إغلاق",
      send: "إرسال",
      writing: "نور تكتب…",
      siteIntro: "أنا نور. أقدر نشرح Nexora والأسعار والناقلين وكيف تفتح العرض.",
      opsIntro: "كنقرأ آخر 7 أيام ديال الوركسبايس. سول على نسبة التسليم، مدينة، رقم NX- أو AWB.",
      placeholderSite: "اكتب سؤالك…",
      placeholderOps: "NX-11546، مدينة، الربح…",
      needLogin: "سجل الدخول باش نقرأ الطلبات — أو بقى هنا وسول على المنتج.",
      unavailable: "الشات بوت غير متاح.",
      sitePrompts: ["شنو هي Nexora؟", "كيفاش ندخل؟", "شنو الناقلين؟"],
      opsPrompts: ["شحال تسليم هاد الأسبوع؟", "أشن هي المدينة الأضعف؟", "فين الربح؟"],
    },
    login: {
      title: "مرحبا بعودتك.",
      hint: "حساب الديمو: amine@atlasatelier.ma / demo1234",
      email: "البريد",
      password: "كلمة المرور",
      totp: "رمز المصادقة",
      totpRequired: "أدخل رمز المصادقة.",
      submit: "دخول",
      pending: "جارٍ الدخول…",
      failed: "تعذر تسجيل الدخول",
      newHere: "جديد هنا؟",
      create: "إنشاء مساحة",
    },
  },
};

export type TranslationKey =
  | "language"
  | `nav.${keyof Dict["nav"]}`
  | `app.${keyof Dict["app"]}`
  | `chat.${Exclude<keyof Dict["chat"], "sitePrompts" | "opsPrompts">}`
  | `login.${keyof Dict["login"]}`;

export function translate(locale: Locale, key: TranslationKey): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const [group, field] = key.split(".") as [keyof Dict, string];
  if (!field) {
    const value = dict[group];
    return typeof value === "string" ? value : key;
  }
  const nested = dict[group] as Record<string, unknown> | undefined;
  const value = nested?.[field];
  return typeof value === "string" ? value : key;
}
