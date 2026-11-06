/**
 * Company registration details and the text of the public legal pages.
 * Written to describe what the system really does (Saudi PDPL art. 12–13): keep
 * it in step when a data recipient, hosting location, or form changes. Update
 * PRIVACY_VERSION (the date shown on the pages) when the text changes. falNo is
 * the REGA activity licence number.
 */
export const COMPANY = {
  nameAr: "بن سلمه العقارية",
  nameEn: "Bin Slmah Real Estate",
  falNo: "", // to be supplied by the owner; the footer shows it once set
  email: "info@binslmahre.com",
  addressAr: "طريق عثمان بن عفان، حي النرجس، الرياض، المملكة العربية السعودية",
  addressEn: "Othman Bin Affan Road, An Narjis, Riyadh, Saudi Arabia",
};

export const PRIVACY_VERSION = "2026-11-06";

export interface LegalSection {
  h: string;
  p?: string[];
  li?: string[];
}
export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const contactAr = `${COMPANY.nameAr}، ${COMPANY.addressAr}. البريد: ${COMPANY.email}`;
const contactEn = `${COMPANY.nameEn}, ${COMPANY.addressEn}. Email: ${COMPANY.email}`;

export const PRIVACY: Record<"ar" | "en", LegalDoc> = {
  ar: {
    title: "سياسة الخصوصية",
    intro: "خصوصيتك تهمنا. توضح هذه الصفحة باختصار ما يصلنا من معلومات عند استخدامك موقع " + COMPANY.nameAr + " وكيف نتعامل معها.",
    sections: [
      { h: "أولاً: من نحن", p: [contactAr] },
      {
        h: "ثانياً: المعلومات التي تصلنا منك",
        p: ["لا يحتاج تصفح الموقع إلى حساب أو تسجيل دخول. تصلنا معلوماتك فقط عندما تقدمها بنفسك:"],
        li: [
          "عند تسجيل طلب عقاري أو اهتمام بعرض: الاسم والجوال وتفاصيل ما تبحث عنه.",
          "عند التقديم على وظيفة: بياناتك الشخصية وخبرتك ورابط سيرتك الذاتية.",
          "عند تواصلك معنا أو تعاملك مع فريقنا: محتوى المراسلات والمكالمات والمواعيد وبيانات الصفقة.",
        ],
      },
      {
        h: "ثالثاً: كيف نستخدمها",
        li: [
          "التواصل معك وخدمة طلبك وترتيب زيارة العقار.",
          "إتمام إجراءات الصفقة وإصدار مستنداتها.",
          "دراسة طلبات التوظيف.",
          "الالتزام بما تفرضه الأنظمة.",
        ],
      },
      { h: "رابعاً: زيارتك للموقع", p: ["لا نستخدم أدوات إعلانية أو تحليلية لتتبّع الزوار. قد تسجل خوادم الاستضافة بيانات تقنية معتادة مثل عنوان الجهاز ونوع المتصفح لأغراض التشغيل والأمان، ويحفظ المتصفح تفضيلاً بسيطاً حتى لا تتكرر الشاشة الافتتاحية."] },
      { h: "خامساً: حماية معلوماتك", p: ["الوصول إلى معلوماتك مقصور على المصرّح لهم من فريقنا، واتصالك بالموقع مشفّر. نحتفظ بها ما دامت لازمة لغرضها أو لما تتطلبه الأنظمة ثم نتلفها. قد تُعالج بعض البيانات لدى مزودي خدمات تقنية خارج المملكة، بالقدر اللازم للتشغيل."] },
      {
        h: "سادساً: أحكام عامة",
        p: [
          `يحق لك طلب الاطلاع على معلوماتك أو تصحيحها أو حذفها أو سحب موافقتك بمراسلتنا على ${COMPANY.email}، ونرد خلال 30 يوماً، ولك تقديم شكوى إلى الجهة المختصة.`,
          "قد نعدّل هذه السياسة، وتُنشر النسخة المحدثة في هذه الصفحة.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    intro: "Your privacy matters to us. This page briefly explains what information reaches us when you use the " + COMPANY.nameEn + " website and how we handle it.",
    sections: [
      { h: "1. Who we are", p: [contactEn] },
      {
        h: "2. Information you give us",
        p: ["Browsing the website needs no account or login. Your information reaches us only when you provide it:"],
        li: [
          "When you register a property request or interest in an offer: your name, mobile number, and what you are looking for.",
          "When you apply for a job: your personal details, experience, and a link to your CV.",
          "When you contact us or deal with our team: messages, calls, appointments, and deal details.",
        ],
      },
      {
        h: "3. How we use it",
        li: [
          "To contact you, serve your request, and arrange property viewings.",
          "To complete a deal and issue its documents.",
          "To review job applications.",
          "To comply with the law.",
        ],
      },
      { h: "4. Your visit to the website", p: ["We use no advertising or analytics tools that track visitors. Hosting servers may record routine technical data, such as device address and browser type, for operation and security, and your browser keeps a simple preference so the opening screen doesn't repeat."] },
      { h: "5. Protecting your information", p: ["Access is limited to authorised members of our team, and your connection to the website is encrypted. We keep your information as long as its purpose or the law requires, then destroy it. Some data may be processed by technical service providers outside the Kingdom, as far as needed to operate."] },
      {
        h: "6. General provisions",
        p: [
          `You may ask to access, correct, or delete your information, or withdraw your consent, by emailing ${COMPANY.email}. We reply within 30 days, and you may complain to the competent authority.`,
          "We may change this policy; the updated version is published on this page.",
        ],
      },
    ],
  },
};

export const TERMS: Record<"ar" | "en", LegalDoc> = {
  ar: {
    title: "شروط الاستخدام",
    intro: "باستخدامك هذا الموقع فإنك توافق على هذه الشروط. يُدار الموقع من قبل " + COMPANY.nameAr + ".",
    sections: [
      { h: "طبيعة الموقع", p: ["يعرض الموقع عروضاً عقارية ويتيح تسجيل الطلبات. المعلومات المعروضة للتعريف والتسويق، ولا تُعد إيجاباً ملزماً أو عقداً. لا تتم عبر الموقع أي عملية دفع."] },
      { h: "دقة المعلومات", p: ["نحرص على دقة البيانات، لكن الأسعار والمساحات والتوفر قد تتغير. تُعتمد البيانات النهائية عند التعاقد، وننصحك بالتحقق منها قبل اتخاذ أي قرار."] },
      { h: "تفاصيل العقار والزيارة", p: ["تُقدَّم التفاصيل الإضافية للعقار وترتيب الزيارة عبر فريقنا بعد التواصل معنا."] },
      { h: "استخدامك للموقع", li: ["تقديم بيانات صحيحة في النماذج.", "عدم إساءة استخدام الموقع أو محاولة اختراقه أو تعطيله.", "عدم جمع بياناته أو محتواه آلياً."] },
      { h: "الملكية الفكرية", p: ["العلامة التجارية والشعار والمحتوى والصور مملوكة لنا أو لأصحابها، ولا يجوز نسخها أو استخدامها دون إذن."] },
      { h: "المسؤولية", p: ["لا نتحمل مسؤولية أي قرار يُبنى على المعلومات المعروضة دون التحقق منها، ولا عن المواقع الخارجية التي قد يرتبط بها الموقع، وذلك في الحدود التي تسمح بها الأنظمة."] },
      { h: "الشكاوى والتواصل", p: [`لأي شكوى أو ملاحظة على إعلان راسلنا على ${COMPANY.email}.`] },
      { h: "النظام المطبّق", p: ["تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختص محاكمها بأي نزاع."] },
    ],
  },
  en: {
    title: "Terms of Use",
    intro: "By using this website you agree to these terms. The website is operated by " + COMPANY.nameEn + ".",
    sections: [
      { h: "About the website", p: ["The website shows property offers and lets you register requests. The information is for introduction and marketing and is not a binding offer or contract. No payments are made through the website."] },
      { h: "Accuracy", p: ["We take care to keep details accurate, but prices, areas, and availability may change. Final details are confirmed at contracting; please verify them before making any decision."] },
      { h: "Property details and viewings", p: ["Further property details and viewings are arranged by our team after you contact us."] },
      { h: "Your use of the website", li: ["Provide correct details in the forms.", "Do not misuse, attack, or disrupt the website.", "Do not collect its data or content automatically."] },
      { h: "Intellectual property", p: ["The brand, logo, content, and images belong to us or their owners and may not be copied or used without permission."] },
      { h: "Liability", p: ["To the extent the law allows, we are not responsible for decisions made on the displayed information without verifying it, or for external websites linked from this site."] },
      { h: "Complaints and contact", p: [`For any complaint or comment about an advertisement, email ${COMPANY.email}.`] },
      { h: "Governing law", p: ["These terms are governed by the laws of the Kingdom of Saudi Arabia, and its courts have jurisdiction over any dispute."] },
    ],
  },
};
