import { contactConfig } from "~/config/contact";
import { deliveryConfig, type DeliveryConfigLocale } from "~/config/delivery";
import { storeConfig } from "~/config/store";

/**
 * Public, client-safe policy and legal-page configuration.
 *
 * This file is safe to import from Server Components, Client Components, and tests.
 * It is not legal advice. Replace and review this copy with each client before launch.
 * Do not put private agreements, private client terms, secrets, credentials, internal
 * escalation contacts, private provider URLs, or admin-only instructions here.
 */
export type PolicyLocale = DeliveryConfigLocale;
export type PolicyPageKey =
  | "terms"
  | "privacy"
  | "shipping"
  | "returns"
  | "contact";

export type PublicPolicyLink = {
  href: string;
  label: string;
};

export type PublicPolicySection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
  links?: readonly PublicPolicyLink[];
};

export type PublicPolicyPage = {
  title: string;
  description: string;
  sections: readonly PublicPolicySection[];
};

export type PublicPolicyDictionary = {
  common: {
    policyBadge: string;
    lastUpdatedLabel: string;
    lastUpdatedDate: string;
    usefulLinks: string;
    footerLinks: Record<PolicyPageKey, string>;
  };
  notices: {
    bySigningIn: string;
    byCreatingAccount: string;
    byPlacingOrder: string;
    privacyPolicy: string;
    termsOfUse: string;
    shippingPolicy: string;
    returnsPolicy: string;
    and: string;
  };
  pages: Record<PolicyPageKey, PublicPolicyPage>;
};

type PublicPoliciesConfig = {
  clientReviewRequiredBeforeLaunch: boolean;
  locales: Record<PolicyLocale, PublicPolicyDictionary>;
};

function definePublicPoliciesConfig(config: PublicPoliciesConfig) {
  return config;
}

type DeliveryAreaConfig = (typeof deliveryConfig.areas)[number];

const englishStoreName = storeConfig.locales.en.name;
const arabicStoreName = storeConfig.locales.ar.name;
// Isolate contact values in prose as well as links so RTL keeps '+' before the number.
const supportPhone = `\u2066${contactConfig.phone.display}\u2069`;
const supportWhatsapp = `\u2066${contactConfig.whatsapp.display}\u2069`;
const supportEmail = `\u2066${contactConfig.email.address}\u2069`;
const englishSupportHours = contactConfig.supportHours.en;
const arabicSupportHours = contactConfig.supportHours.ar;
const englishContactPageDescription = contactConfig.contactPage.description.en;
const arabicContactPageDescription = contactConfig.contactPage.description.ar;

function formatDeliveryPriceItem(
  area: DeliveryAreaConfig,
  locale: PolicyLocale,
): string {
  const label = area.labels[locale].label;
  const priceLabel =
    area.priceNis === 0
      ? deliveryConfig.currency.freeLabels[locale]
      : `${area.priceNis} ${deliveryConfig.currency.labels[locale]}`;

  if (!area.requiresCustomerAgreement) {
    const labels = area.labels[locale];
    const note = "note" in labels ? labels.note : null;
    return `${label}: ${priceLabel}.${note ? ` ${note}` : ""}`;
  }

  if (locale === "ar") {
    return `${label}: ${priceLabel}، بعد موافقة العميل أو التنسيق مع المتجر.`;
  }

  return `${label}: ${priceLabel}, after customer agreement or coordination with the store.`;
}

function formatDeliveryAreaList(locale: PolicyLocale): string {
  const separator = locale === "ar" ? "، " : ", ";
  return deliveryConfig.areas
    .map((area) => area.labels[locale].label)
    .join(separator);
}

const englishDeliveryPriceItems = deliveryConfig.areas.map((area) =>
  formatDeliveryPriceItem(area, "en"),
);
const arabicDeliveryPriceItems = deliveryConfig.areas.map((area) =>
  formatDeliveryPriceItem(area, "ar"),
);
const englishDeliveryAreaList = formatDeliveryAreaList("en");
const arabicDeliveryAreaList = formatDeliveryAreaList("ar");
const englishDeliveryMethod = deliveryConfig.method.labels.en;
const arabicDeliveryMethod = deliveryConfig.method.labels.ar;
const englishEstimatedDeliveryDuration =
  deliveryConfig.estimatedDuration.labels.en;
const arabicEstimatedDeliveryDuration =
  deliveryConfig.estimatedDuration.labels.ar;

export const policyConfig = definePublicPoliciesConfig({
  clientReviewRequiredBeforeLaunch: true,
  locales: {
    en: {
      common: {
        policyBadge: "Store policy",
        lastUpdatedLabel: "Last updated",
        lastUpdatedDate: "October 3, 2026",
        usefulLinks: "Useful links",
        footerLinks: {
          terms: "Terms",
          privacy: "Privacy",
          shipping: "Shipping",
          returns: "Returns",
          contact: "Contact",
        },
      },
      notices: {
        bySigningIn: "By signing in, you agree to our",
        byCreatingAccount: "By creating an account, you agree to our",
        byPlacingOrder: "By placing this order, you agree to our",
        privacyPolicy: "Privacy Policy",
        termsOfUse: "Terms of Use",
        shippingPolicy: "Shipping Policy",
        returnsPolicy: "Returns Policy",
        and: "and",
      },
      pages: {
        terms: {
          title: "Terms of Use",
          description:
            "These terms explain the basic rules for using this store, creating an account, and placing cash-on-delivery orders.",
          sections: [
            {
              title: "1. About the store",
              paragraphs: [
                `${englishStoreName} offers electronic components, IoT supplies and student project kits for hardware projects.`,
              ],
            },
            {
              title: "2. Accounts",
              paragraphs: [
                "You may need an account to place orders, view your order history, and manage your profile information.",
                "You are responsible for keeping your login details safe and for providing accurate account information.",
              ],
            },
            {
              title: "3. Orders and payment",
              paragraphs: [
                "Orders are currently paid by cash on delivery.",
                "Adding products to the cart does not reserve stock. Stock and prices are checked again when the order is placed.",
                "Delivery area, delivery price, and final total are shown before you confirm the order.",
                "The store may contact you using your phone number or email to confirm the order before delivery.",
              ],
            },
            {
              title: "4. Product information",
              paragraphs: [
                "We try to keep product names, prices, images, descriptions, and stock information accurate. However, mistakes may happen.",
                "If an error is found after an order is placed, the store may contact you to correct, cancel, or update the order.",
              ],
            },
            {
              title: "5. Cancellations",
              paragraphs: [
                "You may request to cancel an order as long as it has not already been sent for delivery.",
                "Once the order is on its way, cancellation may not be possible.",
              ],
            },
            {
              title: "6. Website availability",
              paragraphs: [
                "The website may sometimes be unavailable because of maintenance, technical issues, internet problems, or third-party service issues.",
                "The store will try to keep the website working, but uninterrupted access is not guaranteed.",
              ],
            },
            {
              title: "7. Changes to this policy",
              paragraphs: [
                "We may update this Privacy Policy or other store policies from time to time.",
                "When we make changes, we will update the “Last updated” date on the relevant page.",
                "Continued use of the website or placing orders after changes are published means you accept the updated policy.",
              ],
            },
            {
              title: "8. Contact",
              paragraphs: [
                `For questions about orders or these terms, contact us by WhatsApp at ${supportWhatsapp}, by phone at ${supportPhone}, or by email at ${supportEmail}.`,
              ],
            },
          ],
        },
        privacy: {
          title: "Privacy Policy",
          description:
            "This policy explains what information the store collects, why it is used, and which services may process it.",
          sections: [
            {
              title: "1. Information we collect",
              paragraphs: [
                "The website currently collects or stores information such as:",
              ],
              items: [
                "Name, email address, and phone number.",
                "Account details, email verification status, and order history.",
                "Cart items, ordered products, quantities, prices, totals, payment method, and payment status.",
                "Customer name, email, and phone snapshot at the time an order is placed.",
                "Delivery area, delivery city or area text, delivery address/details, delivery notes, delivery price, and pickup/receive-point agreement status when provided during checkout.",
                "Session information, IP address, and user-agent for login, security, and rate limiting.",
                "Theme and language preference stored in your browser.",
              ],
            },
            {
              title: "2. Information not currently collected",
              paragraphs: [
                "The website does not currently collect online card payment details or customer-uploaded images.",
                "Delivery information is collected only as needed to prepare, confirm, and deliver or arrange pickup/receive-point orders.",
              ],
            },
            {
              title: "3. How we use information",
              paragraphs: [
                "We use information to create and manage accounts, process orders, calculate delivery fees, contact customers about orders, arrange delivery or pickup/receive-point coordination, show order history, protect the website, prevent abuse, and maintain store operations.",
              ],
            },
            {
              title: "4. Emails and messages",
              paragraphs: [
                "The website may send account-related emails such as verification or password reset emails.",
                "The store may also send order-related messages.",
                "Marketing messages should only be sent where the customer has agreed or where the store has a valid permission basis.",
              ],
            },
            {
              title: "5. Cookies, sessions, and local storage",
              paragraphs: [
                "The website uses essential session/authentication data to keep users signed in and protect accounts.",
                "It may also store theme and language preferences in the browser.",
                "Security and rate-limiting systems may process IP addresses and request activity.",
                "The website does not currently use Google Analytics, Meta Pixel, TikTok Pixel, or advertising tracking pixels.",
              ],
            },
            {
              title: "6. Service providers",
              paragraphs: [
                "The website may use third-party services for hosting, database storage, image storage, email delivery, and rate limiting/security storage.",
                "These may include Render, Neon or another PostgreSQL provider, Cloudinary, Upstash Redis, Brevo or another SMTP email provider, and domain/DNS providers.",
              ],
            },
            {
              title: "7. Contact",
              paragraphs: [
                `To ask about privacy or request help with your account, contact us by WhatsApp at ${supportWhatsapp}, by phone at ${supportPhone}, or by email at ${supportEmail}.`,
              ],
            },
          ],
        },
        shipping: {
          title: "Shipping / Delivery Policy",
          description:
            "This policy explains the current delivery areas, estimated timing, and delivery prices.",
          sections: [
            {
              title: "1. Delivery and receive areas",
              paragraphs: [
                `Checkout offers these delivery and collection options: ${englishDeliveryAreaList}. Contact us to confirm arrangements for your order.`,
                deliveryConfig.areas[0].labels.en.note,
              ],
            },
            {
              title: "2. Delivery provider",
              paragraphs: [
                `${englishDeliveryMethod}.`,
                "Delivery times may depend on the shipping company, location, weather, traffic, closures, holidays, customer availability, or other events outside the store’s control.",
              ],
            },
            {
              title: "3. Estimated delivery time",
              paragraphs: [`${englishEstimatedDeliveryDuration}.`],
            },
            {
              title: "4. Delivery prices",
              items: englishDeliveryPriceItems,
            },
            {
              title: "5. Delivery details and confirmation",
              paragraphs: [
                "During checkout, the customer selects a delivery area and provides the required city/area and address or receive-point details.",
                "The delivery price and final total are shown before the customer confirms the order.",
                "The store may contact you using your phone number or email to confirm delivery or receive-point details before sending or preparing the order.",
              ],
            },
          ],
        },
        returns: {
          title: "Returns / Refunds Policy",
          description:
            "This policy explains when returns are accepted and how refunds are handled.",
          sections: [
            {
              title: "1. Return and replacement rule",
              paragraphs: [
                "Return or replacement requests are accepted when a product arrives damaged, defective, incorrect, materially different from its description, or is delivered after the agreed time where applicable.",
                "For visible delivery damage or an incorrect item, contact us on WhatsApp with your order details and a description of the issue. Your rights under applicable law remain unaffected.",
              ],
            },
            {
              title: "2. Product condition",
              paragraphs: [
                "Contact us to discuss the product’s condition and the reason for your return request. Opening or using a product does not remove rights relating to a defect or nonconformity under applicable law.",
              ],
            },
            {
              title: "3. Return shipping",
              paragraphs: [
                "Contact us on WhatsApp to coordinate return shipping for your request, subject to applicable rights.",
              ],
            },
            {
              title: "4. Refund requests",
              paragraphs: [
                "For refund requests, contact us on WhatsApp to discuss your order and the next steps.",
              ],
            },
            {
              title: "5. Warranty, maintenance, and support",
              paragraphs: [
                "If a product includes a manufacturer or store warranty, its duration, scope, exclusions, and claim method must be stated on the product page or in a separate document supplied to the customer.",
                "A product is not represented as having a warranty unless one is clearly stated. This does not remove rights relating to defective, damaged, incorrect, late-delivered, or nonconforming products under applicable law.",
                "Contact us with questions about product details, orders, delivery, defects, returns or replacements. Ask about any product-specific maintenance or technical support before ordering.",
              ],
            },
            {
              title: "6. How to request help",
              paragraphs: [
                `Contact us by WhatsApp at ${supportWhatsapp}, by phone at ${supportPhone}, or by email at ${supportEmail}. Include your order details, photos if the product is damaged, and a clear explanation of the issue.`,
              ],
            },
          ],
        },
        contact: {
          title: "Contact",
          description: englishContactPageDescription,
          sections: [
            {
              title: "1. Contact details",
              items: [
                `WhatsApp: ${supportWhatsapp}.`,
                `Phone: ${supportPhone}.`,
                `Support email: ${supportEmail}.`,
                `Messaging: ${englishSupportHours}`,
              ],
            },
            {
              title: "2. How to submit a complaint",
              paragraphs: [
                "Contact the store through any listed channel and provide your name, order number when available, a clear description of the issue, and supporting photos or documents when relevant.",
                "Do not send passwords, verification codes, payment credentials, or unrelated sensitive personal information.",
              ],
            },
            {
              title: "3. Complaint follow-up",
              paragraphs: [
                "The store will review the complaint, request any missing information, and follow up using the contact channel provided by the customer.",
                "Response and resolution times depend on the issue. You can message us anytime; responses may not be immediate.",
                "If the complaint is not resolved, the customer may contact the competent Palestinian consumer-protection or ecommerce authority.",
              ],
            },
          ],
        },
      },
    },
    ar: {
      common: {
        policyBadge: "سياسة المتجر",
        lastUpdatedLabel: "آخر تحديث",
        lastUpdatedDate: "3 أكتوبر 2026",
        usefulLinks: "روابط مفيدة",
        footerLinks: {
          terms: "الشروط",
          privacy: "الخصوصية",
          shipping: "التوصيل",
          returns: "الإرجاع",
          contact: "التواصل",
        },
      },
      notices: {
        bySigningIn: "بتسجيل الدخول، أنت توافق على",
        byCreatingAccount: "بإنشاء الحساب، أنت توافق على",
        byPlacingOrder: "بإرسال هذا الطلب، أنت توافق على",
        privacyPolicy: "سياسة الخصوصية",
        termsOfUse: "شروط الاستخدام",
        shippingPolicy: "سياسة التوصيل",
        returnsPolicy: "سياسة الإرجاع",
        and: "و",
      },
      pages: {
        terms: {
          title: "شروط الاستخدام",
          description:
            "توضح هذه الشروط القواعد الأساسية لاستخدام المتجر وإنشاء الحسابات وإرسال طلبات الدفع عند الاستلام.",
          sections: [
            {
              title: "1. عن المتجر",
              paragraphs: [
                `${arabicStoreName} متجر للمكوّنات الإلكترونية ومستلزمات إنترنت الأشياء وأطقم المشاريع الطلابية للمشاريع العملية في الإلكترونيات.`,
              ],
            },
            {
              title: "2. الحسابات",
              paragraphs: [
                "قد تحتاج إلى حساب لإنشاء الطلبات ومتابعة سجل الطلبات وتحديث بياناتك.",
                "أنت مسؤول عن الحفاظ على سرية بيانات الدخول وتقديم معلومات صحيحة.",
              ],
            },
            {
              title: "3. الطلبات والدفع",
              paragraphs: [
                "يتم الدفع حالياً عند الاستلام.",
                "إضافة المنتجات إلى السلة لا تعني حجز المخزون، ويتم فحص المخزون والأسعار مرة أخرى عند إنشاء الطلب.",
                "يتم عرض منطقة التوصيل وسعر التوصيل والمجموع النهائي قبل تأكيد الطلب.",
                "قد يتواصل المتجر معك عبر رقم الهاتف أو البريد الإلكتروني لتأكيد الطلب قبل التوصيل.",
              ],
            },
            {
              title: "4. معلومات المنتجات",
              paragraphs: [
                "نحاول عرض أسماء المنتجات والأسعار والصور والوصف والمخزون بدقة، لكن قد تحدث أخطاء.",
                "إذا ظهر خطأ بعد إنشاء الطلب، قد يتواصل المتجر معك لتصحيح الطلب أو إلغائه أو تحديثه.",
              ],
            },
            {
              title: "5. الإلغاء",
              paragraphs: [
                "يمكنك طلب إلغاء الطلب طالما لم يتم إرساله للتوصيل.",
                "بعد خروج الطلب للتوصيل، قد لا يكون الإلغاء ممكناً.",
              ],
            },
            {
              title: "6. توفر الموقع",
              paragraphs: [
                "قد يتوقف الموقع أحياناً بسبب الصيانة أو مشاكل تقنية أو مشاكل في الإنترنت أو خدمات خارجية.",
                "يحاول المتجر الحفاظ على عمل الموقع، لكن لا يوجد ضمان بأن يكون الموقع متاحاً بدون انقطاع دائماً.",
              ],
            },
            {
              title: "7. التغييرات على هذه السياسات",
              paragraphs: [
                "قد نقوم بتحديث شروط الاستخدام أو سياسة الخصوصية أو سياسة التوصيل أو سياسة الإرجاع أو أي سياسات أخرى للمتجر من وقت لآخر.",
                "عند إجراء أي تغييرات، سنقوم بتحديث تاريخ آخر تحديث في الصفحة المعنية.",
                "استمرار استخدام الموقع أو إنشاء الطلبات بعد نشر التغييرات يعني موافقتك على السياسة المحدّثة.",
              ],
            },
            {
              title: "8. التواصل",
              paragraphs: [
                `للاستفسار عن الطلبات أو هذه الشروط، يمكنك التواصل معنا عبر واتساب على الرقم ${supportWhatsapp}، أو الهاتف على الرقم ${supportPhone}، أو البريد الإلكتروني ${supportEmail}.`,
              ],
            },
          ],
        },
        privacy: {
          title: "سياسة الخصوصية",
          description:
            "توضح هذه السياسة البيانات التي يجمعها المتجر، سبب استخدامها، والخدمات التي قد تعالجها.",
          sections: [
            {
              title: "1. البيانات التي نجمعها",
              paragraphs: ["يجمع الموقع حالياً أو يخزن بيانات مثل:"],
              items: [
                "الاسم والبريد الإلكتروني ورقم الهاتف.",
                "بيانات الحساب، حالة تأكيد البريد الإلكتروني، وسجل الطلبات.",
                "عناصر السلة، المنتجات المطلوبة، الكميات، الأسعار، المجموع، طريقة الدفع وحالة الدفع.",
                "نسخة من اسم العميل وبريده الإلكتروني ورقم هاتفه وقت إنشاء الطلب.",
                "منطقة التوصيل، المدينة أو المنطقة، العنوان أو تفاصيل الاستلام، ملاحظات التوصيل، سعر التوصيل، وحالة الموافقة على نقطة الاستلام عند إدخالها أثناء إنشاء الطلب.",
                "بيانات الجلسة، عنوان IP، ونوع المتصفح لأغراض تسجيل الدخول والأمان والحد من إساءة الاستخدام.",
                "تفضيل المظهر واللغة المخزن في المتصفح.",
              ],
            },
            {
              title: "2. بيانات لا نجمعها حالياً",
              paragraphs: [
                "لا يجمع الموقع حالياً بيانات بطاقات الدفع الإلكترونية أو صوراً مرفوعة من العملاء.",
                "يتم جمع بيانات التوصيل فقط بالقدر اللازم لتجهيز الطلب، تأكيده، توصيله أو تنسيق الاستلام من نقطة الاستلام.",
              ],
            },
            {
              title: "3. كيف نستخدم البيانات",
              paragraphs: [
                "نستخدم البيانات لإنشاء وإدارة الحسابات، معالجة الطلبات، حساب رسوم التوصيل، التواصل مع العملاء بخصوص الطلبات، تنسيق التوصيل أو الاستلام من نقطة الاستلام، عرض سجل الطلبات، حماية الموقع، منع إساءة الاستخدام، وتشغيل المتجر.",
              ],
            },
            {
              title: "4. البريد الإلكتروني والرسائل",
              paragraphs: [
                "قد يرسل الموقع رسائل متعلقة بالحساب مثل تأكيد البريد الإلكتروني أو إعادة تعيين كلمة المرور.",
                "قد يرسل المتجر أيضاً رسائل متعلقة بالطلبات.",
                "يجب إرسال الرسائل التسويقية فقط عند وجود موافقة من العميل أو أساس مناسب لذلك.",
              ],
            },
            {
              title: "5. ملفات الجلسة والتخزين المحلي",
              paragraphs: [
                "يستخدم الموقع بيانات جلسات أساسية لتسجيل الدخول وحماية الحسابات.",
                "قد يحفظ أيضاً تفضيلات اللغة والمظهر في المتصفح.",
                "قد تعالج أنظمة الأمان والحد من الطلبات عنوان IP ونشاط الطلبات.",
                "لا يستخدم الموقع حالياً أدوات تتبع إعلانية مثل Google Analytics أو Meta Pixel أو TikTok Pixel.",
              ],
            },
            {
              title: "6. مزودو الخدمات",
              paragraphs: [
                "قد يستخدم الموقع خدمات خارجية للاستضافة وقاعدة البيانات وتخزين الصور وإرسال البريد الإلكتروني والتخزين الخاص بالأمان والحد من الطلبات.",
                "قد تشمل هذه الخدمات Render و Neon أو مزود PostgreSQL آخر و Cloudinary و Upstash Redis و Brevo أو مزود SMTP آخر ومزودي النطاقات و DNS.",
              ],
            },
            {
              title: "7. التواصل",
              paragraphs: [
                `للاستفسار عن الخصوصية أو طلب المساعدة بخصوص الحساب، يمكنك التواصل معنا عبر واتساب على الرقم ${supportWhatsapp}، أو الهاتف على الرقم ${supportPhone}، أو البريد الإلكتروني ${supportEmail}.`,
              ],
            },
          ],
        },
        shipping: {
          title: "سياسة التوصيل",
          description:
            "توضح هذه السياسة مناطق التوصيل الحالية، المدة المتوقعة، وأسعار التوصيل.",
          sections: [
            {
              title: "1. مناطق التوصيل والاستلام",
              paragraphs: [
                `تتوفر خيارات التوصيل والاستلام التالية عند إتمام الطلب: ${arabicDeliveryAreaList}. تواصل معنا لتأكيد ترتيبات طلبك.`,
                deliveryConfig.areas[0].labels.ar.note,
              ],
            },
            {
              title: "2. مزود التوصيل",
              paragraphs: [
                `${arabicDeliveryMethod}.`,
                "قد تختلف مدة التوصيل حسب شركة الشحن، المنطقة، الطقس، الحركة، الإغلاقات، العطل، توفر العميل أو أمور أخرى خارج سيطرة المتجر.",
              ],
            },
            {
              title: "3. مدة التوصيل المتوقعة",
              paragraphs: [`${arabicEstimatedDeliveryDuration}.`],
            },
            {
              title: "4. أسعار التوصيل",
              items: arabicDeliveryPriceItems,
            },
            {
              title: "5. تفاصيل التوصيل والتأكيد",
              paragraphs: [
                "أثناء إنشاء الطلب، يختار العميل منطقة التوصيل ويدخل المدينة أو المنطقة المطلوبة والعنوان أو تفاصيل نقطة الاستلام.",
                "يتم عرض سعر التوصيل والمجموع النهائي قبل تأكيد الطلب.",
                "قد يتواصل المتجر معك عبر رقم الهاتف أو البريد الإلكتروني لتأكيد تفاصيل التوصيل أو الاستلام قبل إرسال الطلب أو تجهيزه.",
              ],
            },
          ],
        },
        returns: {
          title: "سياسة الإرجاع والاسترداد",
          description:
            "توضح هذه السياسة متى يتم قبول الإرجاع وكيف يتم التعامل مع الاسترداد.",
          sections: [
            {
              title: "1. قاعدة الإرجاع والاستبدال",
              paragraphs: [
                "يتم قبول طلبات الإرجاع أو الاستبدال إذا وصل المنتج تالفاً أو معيباً أو خاطئاً أو مختلفاً بشكل جوهري عن وصفه، أو إذا تم تسليمه بعد الموعد المتفق عليه حيث ينطبق ذلك.",
                "في حال وجود تلف ظاهر أثناء التوصيل أو استلام منتج خاطئ، تواصل معنا عبر واتساب مع تفاصيل الطلب ووصف المشكلة. تبقى حقوقك بموجب القانون النافذ محفوظة.",
              ],
            },
            {
              title: "2. حالة المنتج",
              paragraphs: [
                "تواصل معنا لمناقشة حالة المنتج وسبب طلب الإرجاع. فتح المنتج أو استخدامه لا يلغي الحقوق المتعلقة بالعيب أو عدم المطابقة بموجب القانون النافذ.",
              ],
            },
            {
              title: "3. شحن الإرجاع",
              paragraphs: [
                "تواصل معنا عبر واتساب لتنسيق شحن الإرجاع لطلبك، مع مراعاة الحقوق المقررة قانوناً.",
              ],
            },
            {
              title: "4. طلبات الاسترداد",
              paragraphs: [
                "لطلب الاسترداد، تواصل معنا عبر واتساب لمناقشة طلبك والخطوات التالية.",
              ],
            },
            {
              title: "5. الضمان والصيانة والدعم",
              paragraphs: [
                "إذا كان المنتج يشمل ضماناً من الشركة المصنّعة أو المتجر، فيجب توضيح مدته ونطاقه والاستثناءات وطريقة المطالبة به في صفحة المنتج أو في وثيقة مستقلة تسلّم للعميل.",
                "لا يُعتبر المنتج مشمولاً بضمان ما لم يتم توضيح ذلك صراحة. ولا يؤثر ذلك على الحقوق المتعلقة بالمنتج المعيب أو التالف أو الخاطئ أو المتأخر أو غير المطابق وفق القانون النافذ.",
                "تواصل معنا بشأن تفاصيل المنتج والطلبات والتوصيل والعيوب والإرجاع والاستبدال. اسأل عن أي صيانة أو دعم فني خاص بالمنتج قبل الطلب.",
              ],
            },
            {
              title: "6. طريقة طلب المساعدة",
              paragraphs: [
                `للتواصل، استخدم واتساب على الرقم ${supportWhatsapp}، أو الهاتف على الرقم ${supportPhone}، أو البريد الإلكتروني ${supportEmail}. أرسل تفاصيل الطلب وصور المنتج إن كان تالفاً وشرحاً واضحاً للمشكلة.`,
              ],
            },
          ],
        },
        contact: {
          title: "تواصل معنا",
          description: arabicContactPageDescription,
          sections: [
            {
              title: "1. بيانات التواصل",
              items: [
                `واتساب: ${supportWhatsapp}.`,
                `الهاتف: ${supportPhone}.`,
                `البريد الإلكتروني للدعم: ${supportEmail}.`,
                `المراسلة: ${arabicSupportHours}`,
              ],
            },
            {
              title: "2. طريقة تقديم الشكوى",
              paragraphs: [
                "تواصل مع المتجر من خلال أي قناة معلنة، وأرسل اسمك ورقم الطلب إن وجد ووصفاً واضحاً للمشكلة، مع الصور أو المستندات الداعمة عند الحاجة.",
                "لا ترسل كلمات المرور أو رموز التحقق أو بيانات الدفع أو معلومات شخصية حساسة لا علاقة لها بالشكوى.",
              ],
            },
            {
              title: "3. متابعة الشكوى",
              paragraphs: [
                "يراجع المتجر الشكوى ويطلب أي معلومات ناقصة ويتابع مع العميل من خلال وسيلة التواصل التي قدمها.",
                "تعتمد مدة الرد والحل على طبيعة المشكلة. يمكنك مراسلتنا في أي وقت؛ قد لا يكون الرد فورياً.",
                "إذا لم تتم معالجة الشكوى، يمكن للعميل التواصل مع الجهة الفلسطينية المختصة بحماية المستهلك أو التجارة الإلكترونية.",
              ],
            },
          ],
        },
      },
    },
  },
});

export type PolicyConfig = typeof policyConfig;
