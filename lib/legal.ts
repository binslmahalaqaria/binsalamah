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
  cr: "7041122982",
  vat: "310815589200003",
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

const contactAr = `${COMPANY.nameAr}، سجل تجاري ${COMPANY.cr}، ${COMPANY.addressAr}. البريد: ${COMPANY.email}`;
const contactEn = `${COMPANY.nameEn}, Commercial Registration ${COMPANY.cr}, ${COMPANY.addressEn}. Email: ${COMPANY.email}`;

export const PRIVACY: Record<"ar" | "en", LegalDoc> = {
  ar: {
    title: "سياسة الخصوصية",
    intro: "نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية وفق نظام حماية البيانات الشخصية في المملكة العربية السعودية ولوائحه. توضح هذه السياسة ما نجمعه ولماذا وكيف نحميه وما حقوقك.",
    sections: [
      { h: "من المسؤول عن بياناتك", p: [contactAr] },
      {
        h: "البيانات التي نجمعها",
        li: [
          "نموذج الطلب العقاري وتسجيل الاهتمام: الاسم، رقم الجوال، وتفاصيل طلبك (النوع، المدينة، الحي، الميزانية، المساحة، طريقة الدفع، وأي ملاحظة تكتبها).",
          "نموذج التوظيف: الاسم، العمر، الجنسية، الجوال، البريد، المدينة، الخبرة، ورابط السيرة الذاتية.",
          "عند التعامل معنا: ما يلزم لخدمتك وإتمام الصفقة، مثل سجل التواصل والمكالمات ومحادثات واتساب مع فريقنا، ومواعيد الزيارة، وبيانات العربون والعقد والفاتورة.",
        ],
        p: ["لا نستخدم في الموقع أدوات إعلانية أو تحليلية لتتبّع الزوار. يحفظ الموقع في متصفحك تفضيلاً بسيطاً لعرض الشاشة الافتتاحية مرة واحدة، ولا يتضمن بيانات شخصية."],
      },
      { h: "كيف نجمعها", p: ["مباشرة منك عبر نماذج الموقع، أو عند تواصلك معنا بالهاتف أو واتساب أو البريد أو زيارتك لمكتبنا، أو عبر قنواتنا التسويقية إذا راسلتنا من خلالها."] },
      {
        h: "لماذا نستخدمها",
        li: [
          "الرد على طلبك والبحث عن عقار يناسبك وترتيب الزيارات.",
          "إتمام إجراءات الوساطة والبيع وإصدار الفواتير والسندات.",
          "دراسة طلبات التوظيف.",
          "الوفاء بالالتزامات النظامية تجاه الجهات المختصة.",
        ],
        p: ["نعالج بياناتك بموافقتك، أو لتنفيذ اتفاق معك، أو لأن النظام يتطلب ذلك. لن نرسل لك رسائل تسويقية إلا بموافقتك، ويمكنك إيقافها في أي وقت."],
      },
      {
        h: "مع من نشاركها",
        p: ["لا نبيع بياناتك. يطّلع عليها موظفونا المعنيون بخدمتك، ونستعين بمزودي خدمات يعالجونها نيابة عنا وبالقدر اللازم فقط:"],
        li: [
          "Google (Firebase): قاعدة البيانات مستضافة في مدينة الدمام بالمملكة، وتسجيل الدخول والملفات لدى Google.",
          "Vercel: استضافة الموقع والنظام (خارج المملكة).",
          "Railway: خادم ربط واتساب بالنظام (خارج المملكة).",
          "Anthropic: المساعد الذكي الذي يستخدمه موظفونا داخل النظام (خارج المملكة).",
          "WhatsApp: عند مراسلتك عبره.",
          "Zoho: البريد الإلكتروني (مركز بيانات في المملكة).",
          "الجهات الحكومية المختصة عند وجود إلزام نظامي، مثل هيئة الزكاة والضريبة والجمارك والهيئة العامة للعقار.",
          "المالك أو المطور عند اللزوم لإتمام صفقتك.",
        ],
      },
      { h: "نقل البيانات خارج المملكة", p: ["بما أن بعض مزودي الخدمة أعلاه يعملون خارج المملكة، قد تُنقل بعض بياناتك إليهم. نقتصر على الحد الأدنى اللازم، ونطبق الضمانات التي تتطلبها أنظمة المملكة."] },
      { h: "كيف نحميها ونحتفظ بها", p: ["نقيّد الوصول إلى البيانات بحسابات الموظفين المصرّح لهم، ونشفّر الاتصال بالموقع، ونحتفظ بنسخ احتياطية مؤمنة. نحتفظ ببياناتك طوال المدة اللازمة لتحقيق الغرض منها أو ما تتطلبه الأنظمة، ثم نتلفها أو نجعلها غير معرّفة. إذا وقع حادث يمس بياناتك نبلّغ الجهة المختصة ونبلغك وفق ما يقرره النظام."] },
      {
        h: "حقوقك",
        li: [
          "معرفة كيف نعالج بياناتك.",
          "الحصول على نسخة منها.",
          "تصحيحها أو استكمالها.",
          "طلب إتلافها إذا انتهت الحاجة إليها، ما لم يلزمنا النظام بالاحتفاظ بها.",
          "سحب موافقتك في أي وقت، دون أثر على ما تم قبل السحب.",
          "تقديم شكوى إلى الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).",
        ],
        p: [`لممارسة أي من هذه الحقوق راسلنا على ${COMPANY.email}، ونرد خلال 30 يوماً.`],
      },
      { h: "الأطفال", p: ["خدماتنا موجهة للبالغين، ولا نجمع عن قصد بيانات من هم دون 18 سنة."] },
      { h: "تحديث هذه السياسة", p: ["قد نحدّث هذه السياسة وننشر النسخة الجديدة هنا مع تاريخها."] },
    ],
  },
  en: {
    title: "Privacy Policy",
    intro: "We respect your privacy and protect your personal data in line with Saudi Arabia's Personal Data Protection Law and its regulations. This policy explains what we collect, why, how we protect it, and your rights.",
    sections: [
      { h: "Who is responsible for your data", p: [contactEn] },
      {
        h: "What we collect",
        li: [
          "Property request and interest forms: name, mobile number, and your request details (type, city, district, budget, area, payment method, and any note you write).",
          "Careers form: name, age, nationality, mobile, email, city, experience, and a CV link.",
          "When you deal with us: what we need to serve you and complete a deal, such as contact and call history, WhatsApp conversations with our team, viewing appointments, and deposit, contract, and invoice details.",
        ],
        p: ["The website uses no advertising or analytics tools that track visitors. It stores a simple preference in your browser so the opening screen shows once; this contains no personal data."],
      },
      { h: "How we collect it", p: ["Directly from you through the website forms, when you contact us by phone, WhatsApp, or email or visit our office, or through our marketing channels if you message us there."] },
      {
        h: "Why we use it",
        li: [
          "To answer your request, find a suitable property, and arrange viewings.",
          "To complete brokerage and sale procedures and issue invoices and receipts.",
          "To review job applications.",
          "To meet our legal obligations to the competent authorities.",
        ],
        p: ["We process your data with your consent, to perform an agreement with you, or because the law requires it. We send marketing messages only with your consent, and you can stop them at any time."],
      },
      {
        h: "Who we share it with",
        p: ["We do not sell your data. The staff serving you can access it, and service providers process it on our behalf, only as far as needed:"],
        li: [
          "Google (Firebase): the database is hosted in Dammam, Saudi Arabia; sign-in and files are with Google.",
          "Vercel: website and system hosting (outside the Kingdom).",
          "Railway: the server linking WhatsApp to our system (outside the Kingdom).",
          "Anthropic: the AI assistant our staff use inside the system (outside the Kingdom).",
          "WhatsApp: when you message us through it.",
          "Zoho: email (data centre in the Kingdom).",
          "Competent government authorities where the law requires, such as ZATCA and the Real Estate General Authority.",
          "The owner or developer where needed to complete your deal.",
        ],
      },
      { h: "Transfers outside the Kingdom", p: ["Because some of the providers above operate outside the Kingdom, some of your data may be transferred to them. We limit this to the minimum needed and apply the safeguards Saudi law requires."] },
      { h: "How we protect and keep it", p: ["We restrict access to authorised staff accounts, encrypt connections to the website, and keep secure backups. We keep your data as long as needed for its purpose or as the law requires, then destroy or de-identify it. If an incident affects your data, we notify the competent authority and you as the law requires."] },
      {
        h: "Your rights",
        li: [
          "To know how we process your data.",
          "To obtain a copy of it.",
          "To correct or complete it.",
          "To ask us to destroy it once no longer needed, unless the law requires us to keep it.",
          "To withdraw your consent at any time, without affecting what was done before.",
          "To complain to the Saudi Data & AI Authority (SDAIA).",
        ],
        p: [`To use any of these rights, email ${COMPANY.email}. We reply within 30 days.`],
      },
      { h: "Children", p: ["Our services are for adults, and we do not knowingly collect data from anyone under 18."] },
      { h: "Changes to this policy", p: ["We may update this policy and will publish the new version here with its date."] },
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
