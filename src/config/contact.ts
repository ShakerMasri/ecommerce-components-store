/**
 * Public, client-safe contact and support configuration.
 *
 * This file is safe to import from Server Components, Client Components, and tests.
 * Keep only public storefront contact details here. Do not put SMTP credentials,
 * inbox passwords, API tokens, private webhook URLs, or internal admin contacts here.
 */

export type ContactSocialIconName = "instagram" | "whatsapp" | "facebook";

type PublicSocialLink = {
  label: string;
  href: `https://${string}`;
  icon: ContactSocialIconName;
};

type LocalizedText = {
  en: string;
  ar: string;
};

type PublicContactConfig = {
  email: {
    address: string;
    href: `mailto:${string}`;
  };
  phone: {
    display: string;
    href: `tel:${string}`;
  };
  whatsapp: {
    display: string;
    href: `https://wa.me/${string}`;
  };
  supportHours: LocalizedText;
  contactPage: {
    description: LocalizedText;
  };
  footer: {
    showContactSummary: boolean;
    onlineStoreCta: {
      enabled: boolean;
    };
  };
  whatsappShortcut: {
    enabled: boolean;
  };
  socialLinks: readonly PublicSocialLink[];
};

const socialLinks: readonly PublicSocialLink[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/darakit_store/",
    icon: "instagram",
  },
  {
    label: "WhatsApp",
    href: "https://wa.me/970599355107",
    icon: "whatsapp",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61595079028138",
    icon: "facebook",
  },
];

export const contactConfig = {
  email: {
    address: "support@darakit.com",
    href: "mailto:support@darakit.com",
  },
  phone: {
    display: "+970599355107",
    href: "tel:+970599355107",
  },
  whatsapp: {
    display: "+970599355107",
    href: "https://wa.me/970599355107",
  },
  supportHours: {
    en: "You can message us anytime. Responses may not be immediate.",
    ar: "يمكنك مراسلتنا في أي وقت. قد لا يكون الرد فورياً.",
  },
  contactPage: {
    description: {
      en: "Contact us with questions about products, orders, delivery, exchanges, or returns.",
      ar: "عندك سؤال عن قطعة، طلب، توصيل، استبدال أو إرجاع؟ تواصل معنا.",
    },
  },
  footer: {
    showContactSummary: true,
    onlineStoreCta: {
      enabled: false,
    },
  },
  whatsappShortcut: {
    enabled: true,
  },
  socialLinks,
} as const satisfies PublicContactConfig;

export type ContactConfig = typeof contactConfig;
export type ContactSocialLink = ContactConfig["socialLinks"][number];
