/**
 * Locale registry and translation dictionary for English and Hindi.
 *
 * Designed for easy extension to other Indian languages while strictly keeping
 * domain rules, canonical values, and IDs unchanged.
 */

export type LocaleCode = "en" | "hi";

export type LocaleRegistryItem = {
  code: string;
  name: string;
  nativeName: string;
  isAvailable: boolean;
};

export const LOCALE_REGISTRY: LocaleRegistryItem[] = [
  { code: "en", name: "English", nativeName: "English", isAvailable: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", isAvailable: true },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", isAvailable: false },
  { code: "mr", name: "Marathi", nativeName: "मराठी", isAvailable: false },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", isAvailable: false },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", isAvailable: false },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", isAvailable: false },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", isAvailable: false },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", isAvailable: false },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", isAvailable: false },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", isAvailable: false },
  { code: "as", name: "Assamese", nativeName: "অसमীয়া", isAvailable: false },
  { code: "ur", name: "Urdu", nativeName: "اردو", isAvailable: false },
];

export const TRANSLATIONS = {
  en: {
    // Navigation & Brand
    app_title: "Sahayak",
    tagline: "Multilingual Citizen Assistance",
    schemes: "Schemes",
    admin_dashboard: "Admin Dashboard",
    change_preferences: "Preferences",

    // Onboarding / Preferences Dialog
    preferences_title: "Customize Your Experience",
    preferences_desc: "Select your preferred language and location to discover relevant government assistance. Stored only for this session.",
    select_language: "Preferred Language",
    select_state: "State / Union Territory",
    select_district: "District (Optional)",
    all_districts: "All Districts / Not specified",
    select_area: "Area Type",
    area_rural: "Rural",
    area_urban: "Urban",
    area_skip: "Prefer not to say / Skip",
    save_preferences: "Save & Discover Schemes",
    reset_preferences: "Reset Preferences",
    cancel: "Cancel",

    // Main Discovery Sections
    state_schemes_heading: "Schemes for your State",
    state_schemes_subheading: "Verified state government welfare and assistance programs.",
    central_schemes_heading: "Central Government Schemes",
    central_schemes_subheading: "Nationwide welfare initiatives applicable across India.",
    scholarships_heading: "Scholarships & Student Aid",
    scholarships_subheading: "Educational grants, study support, and student allowances.",

    // Disclaimers & Notes
    domicile_disclaimer:
      "State selection helps discover relevant schemes, but is not treated as domicile or eligibility proof.",
    official_disclaimer:
      "This is an indicative catalogue. Official applications must be submitted on official department portals.",

    // Empty States
    no_state_schemes: "No verified schemes available for this state yet.",
    no_state_selected: "Select your State to view local government schemes.",
    no_central_schemes: "No central government schemes found matching criteria.",
    no_scholarships: "No scholarship programs currently matching your selection.",
    choose_state_btn: "Select State",

    // Scheme Card & Details
    view_details: "View Details →",
    prepare_application: "Prepare Application",
    jurisdiction_central: "Central Scheme",
    jurisdiction_state: "State Scheme",
    department: "Department",
    verified: "Verified",
    search_placeholder: "Search schemes by name, department, or benefits...",
    filter_all: "All",
    total_found: "schemes available",
  },
  hi: {
    // Navigation & Brand
    app_title: "सहायक",
    tagline: "नागरिक सहायता मंच",
    schemes: "योजनाएं",
    admin_dashboard: "प्रशासन डैशबोर्ड",
    change_preferences: "प्राथमिकताएं",

    // Onboarding / Preferences Dialog
    preferences_title: "अपनी प्राथमिकताएं चुनें",
    preferences_desc: "अपने राज्य और भाषा का चयन करें ताकि आपको उपयुक्त सरकारी योजनाएं दिखाई जा सकें। यह केवल इस सत्र के लिए सहेजा जाता है।",
    select_language: "पसंदीदा भाषा",
    select_state: "राज्य / केंद्र शासित प्रदेश",
    select_district: "ज़िला (वैकल्पिक)",
    all_districts: "सभी ज़िले / निर्दिष्ट नहीं",
    select_area: "क्षेत्र प्रकार",
    area_rural: "ग्रामीण",
    area_urban: "शहरी",
    area_skip: "बताना नहीं चाहते / छोड़ें",
    save_preferences: "सहेजें और योजनाएं देखें",
    reset_preferences: "प्राथमिकताएं रीसेट करें",
    cancel: "रद्द करें",

    // Main Discovery Sections
    state_schemes_heading: "आपके राज्य की योजनाएं",
    state_schemes_subheading: "सत्यापित राज्य सरकारी कल्याण और सहायता कार्यक्रम।",
    central_schemes_heading: "केन्द्र सरकार की योजनाएं",
    central_schemes_subheading: "पूरे भारत में लागू राष्ट्रव्यापी कल्याणकारी पहल।",
    scholarships_heading: "छात्रवृत्तियां और शिक्षा सहायता",
    scholarships_subheading: "शैक्षणिक अनुदान, अध्ययन सहायता और छात्रवृत्ति भत्ते।",

    // Disclaimers & Notes
    domicile_disclaimer:
      "राज्य का चयन केवल योजनाएं खोजने में मदद करता है, इसे निवास या पात्रता का आधिकारिक प्रमाण नहीं माना जाता है।",
    official_disclaimer:
      "यह एक सांकेतिक विवरण है। आधिकारिक आवेदन संबंधित सरकारी पोर्टल पर ही जमा किए जाने चाहिए।",

    // Empty States
    no_state_schemes: "इस राज्य के लिए अभी कोई सत्यापित योजना उपलब्ध नहीं है।",
    no_state_selected: "स्थानीय सरकारी योजनाएं देखने के लिए अपने राज्य का चयन करें।",
    no_central_schemes: "इस मानदंड से मेल खाती कोई केंद्रीय योजना नहीं मिली।",
    no_scholarships: "आपके चयन से मेल खाती कोई छात्रवृत्ति योजना अभी उपलब्ध नहीं है।",
    choose_state_btn: "राज्य चुनें",

    // Scheme Card & Details
    view_details: "विवरण देखें →",
    prepare_application: "आवेदन तैयारी",
    jurisdiction_central: "केन्द्रीय योजना",
    jurisdiction_state: "राज्य योजना",
    department: "विभाग",
    verified: "सत्यापित",
    search_placeholder: "योजना का नाम, विभाग या लाभ खोजें...",
    filter_all: "सभी",
    total_found: "योजनाएं उपलब्ध",
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function t(lang: string | undefined, key: TranslationKey): string {
  const code = (lang === "hi" ? "hi" : "en") as LocaleCode;
  return TRANSLATIONS[code][key] || TRANSLATIONS.en[key] || key;
}
