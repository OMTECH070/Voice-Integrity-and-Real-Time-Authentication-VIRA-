/**
 * Easy Mode Translations Dictionary (English & Hindi)
 * Plain-language, accessible translations for general users.
 * All voice authenticity copy strictly respects probabilistic language guidelines.
 */

export type EasyModeLanguage = "en" | "hi";

export interface TranslationSchema {
  // Navigation & General
  easyMode: string;
  exitEasyMode: string;
  chooseLanguage: string;
  chooseLanguageTitle: string;
  chooseLanguagePrompt: string;
  english: string;
  hindi: string;
  signIn: string;
  signUp: string;
  logout: string;
  profile: string;
  home: string;
  contacts: string;
  back: string;

  // Audio / Speech Synthesis
  listen: string;
  stop: string;
  listening: string;
  speechNotSupported: string;

  // Calls
  startCall: string;
  endCall: string;
  call: string;
  calling: string;
  ringing: string;
  connecting: string;
  connected: string;
  callEnded: string;
  mute: string;
  unmute: string;
  speaking: string;
  online: string;
  offline: string;

  // Voice & Security Concepts
  voiceSafety: string;
  riskLevel: string;
  whyFlagged: string;
  verifyBeforeTransfer: string;
  neverShareOtp: string;
  reportSuspicious: string;
  moreDetails: string;
  hideDetails: string;
  technicalDetails: string;

  // Call Recording & Safety Actions
  record: string;
  stopRecording: string;
  recording: string;
  recordingSaved: string;
  playRecording: string;
  pauseRecording: string;
  playback: string;
  downloadRecording: string;
  reportScamCall: string;
  callReported: string;
  whyViraFlagged: string;
  whyViraFlaggedTitle: string;
  noReasonEvidence: string;
  recordings: string;
  callRecordings: string;
  noRecordings: string;
  delete: string;
  deleteRecording: string;
  deleteConfirm: string;
  storageFull: string;
  duration: string;
  size: string;
  localPrivacyNotice: string;

  // Launching Soon Experience
  launchingSoon: string;
  launchingSoonTitle: string;
  launchingSoonSubtitle: string;
  launchingSoonAccountReady: string;
  launchingSoonAccountDesc: string;
  launchingSoonSpoken: string;

  // Statuses
  waitingForAnalysis: string;
  analysisUnavailable: string;
  evaluatingVoice: string;
  safeVoice: string;
  safeVoiceDesc: string;
  aiVoiceWarning: string;
  aiVoiceWarningDesc: string;
  mismatchWarning: string;
  mismatchWarningDesc: string;
  unverifiedVoice: string;
  unverifiedVoiceDesc: string;

  // Risk Levels
  lowRisk: string;
  lowRiskDesc: string;
  mediumRisk: string;
  mediumRiskDesc: string;
  highRisk: string;
  highRiskDesc: string;

  // Social Engineering Signal Warnings
  signalMoneyRequest: string;
  signalUrgency: string;
  signalCredentialRequest: string;
  signalImpersonation: string;
  signalPressureTactic: string;

  // Easy Mode Landing / Guide
  welcomeTitle: string;
  welcomeSubtitle: string;
  rule1Title: string;
  rule1Desc: string;
  rule2Title: string;
  rule2Desc: string;
  rule3Title: string;
  rule3Desc: string;
  reportAdviceTitle: string;
  reportAdviceDesc: string;
  testCallPrompt: string;
  learnMoreTechnical: string;

  // Spoken Summaries for Listen Button
  landingSpokenSummary: string;
  callSpokenSafe: string;
  callSpokenWarning: string;
  callSpokenHighRisk: string;

  // Authentication Page
  authSubtitle: string;
  authBackLink: string;
  continueWithGoogle: string;
  connectingGoogle: string;
  orDivider: string;
  authSignInTab: string;
  authRegisterTab: string;
  authEmailLabel: string;
  authEmailPlaceholder: string;
  authPasswordLabel: string;
  authPasswordPlaceholderLogin: string;
  authPasswordPlaceholderRegister: string;
  authDisplayNameLabel: string;
  authDisplayNamePlaceholder: string;
  authSignInBtn: string;
  authSigningInBtn: string;
  authCreateAccountBtn: string;
  authCreatingAccountBtn: string;
  authSuccessTitle: string;
  authSuccessDesc: string;
  authShowPassword: string;
  authHidePassword: string;
  authEmailRequired: string;
  authEmailInvalid: string;
  authPasswordRequired: string;
  authPasswordTooShort: string;
  authDisplayNameRequired: string;
  authDisplayNameTooShort: string;
  authDisplayNameTooLong: string;
  authForgotPassword: string;
  authDontHaveAccount: string;
  authAlreadyHaveAccount: string;
  authContinue: string;
}

export const EASY_MODE_TRANSLATIONS: Record<EasyModeLanguage, TranslationSchema> = {
  en: {
    // Navigation & General
    easyMode: "Easy Mode",
    exitEasyMode: "Exit Easy Mode",
    chooseLanguage: "Choose Language",
    chooseLanguageTitle: "Choose Language / भाषा चुनें",
    chooseLanguagePrompt: "Select your preferred language for Easy Mode:",
    english: "English",
    hindi: "हिंदी",
    signIn: "Sign In",
    signUp: "Sign Up",
    logout: "Log Out",
    profile: "Profile",
    home: "Home",
    contacts: "Contacts",
    back: "Back",

    // Audio / Speech Synthesis
    listen: "Listen",
    stop: "Stop",
    listening: "Reading aloud...",
    speechNotSupported: "Speech reading is not supported on this browser.",

    // Calls
    startCall: "Start Call",
    endCall: "End Call",
    call: "Call",
    calling: "Calling...",
    ringing: "Ringing...",
    connecting: "Connecting...",
    connected: "Call Connected",
    callEnded: "Call Ended",
    mute: "Mute",
    unmute: "Unmute",
    speaking: "Speaking...",
    online: "Available",
    offline: "Offline",

    // Voice & Security Concepts
    voiceSafety: "Voice Safety",
    riskLevel: "Risk Level",
    whyFlagged: "Why was this flagged?",
    verifyBeforeTransfer: "Verify Before You Transfer",
    neverShareOtp: "Never share your OTP or PIN",
    reportSuspicious: "Report Suspicious Call",
    moreDetails: "More details",
    hideDetails: "Hide details",
    technicalDetails: "Technical Specifications",

    // Call Recording & Safety Actions
    record: "Record",
    stopRecording: "Stop Recording",
    recording: "Recording...",
    recordingSaved: "Recording saved locally.",
    playRecording: "Play",
    pauseRecording: "Pause",
    playback: "Playback",
    downloadRecording: "Download",
    reportScamCall: "Report Scam Call",
    callReported: "Call reported as suspicious.",
    whyViraFlagged: "Why VIRA Flagged It",
    whyViraFlaggedTitle: "Why VIRA Flagged This Call",
    noReasonEvidence: "VIRA does not have enough evidence to provide a specific reason.",
    recordings: "Recordings",
    callRecordings: "Call Recordings",
    noRecordings: "No recordings saved yet.",
    delete: "Delete",
    deleteRecording: "Delete Recording",
    deleteConfirm: "Delete this recording?",
    storageFull: "Unable to save recording. Device storage is full.",
    duration: "Duration",
    size: "Size",
    localPrivacyNotice: "Recordings are stored only on your device and never uploaded.",

    // Launching Soon Experience
    launchingSoon: "Launching Soon",
    launchingSoonTitle: "VIRA is getting ready for you.",
    launchingSoonSubtitle: "Advanced voice integrity and secure calling features will be available soon.",
    launchingSoonAccountReady: "Account Verified",
    launchingSoonAccountDesc: "Your account is active. Full voice protection and calling features will unlock shortly.",
    launchingSoonSpoken: "VIRA is getting ready for you. Advanced voice integrity and secure calling features will be available soon. Your account has been verified.",

    // Statuses
    waitingForAnalysis: "Waiting for analysis",
    analysisUnavailable: "Analysis unavailable",
    evaluatingVoice: "Listening to voice...",
    safeVoice: "Likely Real Person",
    safeVoiceDesc: "The caller voice shows natural human characteristics with high probability.",
    aiVoiceWarning: "Warning: Possible Computer Voice",
    aiVoiceWarningDesc: "The caller voice may be generated or modified using computer voice cloning.",
    mismatchWarning: "Warning: Voice Does Not Match Contact",
    mismatchWarningDesc: "The caller voice appears human, but does not match your enrolled contact.",
    unverifiedVoice: "Unverified Voice",
    unverifiedVoiceDesc: "No enrolled voice profile on file for this contact.",

    // Risk Levels
    lowRisk: "Low (Safe)",
    lowRiskDesc: "Normal conversation. No threat patterns detected.",
    mediumRisk: "Medium (Be Careful)",
    mediumRiskDesc: "Suspicious conversation patterns noticed. Proceed with caution.",
    highRisk: "High Danger!",
    highRiskDesc: "High probability scam or extortion pattern detected on this call.",

    // Social Engineering Signal Warnings
    signalMoneyRequest: "💸 The caller is asking about money.",
    signalUrgency: "⏱️ The caller may be trying to rush you.",
    signalCredentialRequest: "🔐 Someone may be asking for sensitive information (OTP or PIN).",
    signalImpersonation: "🏛️ The caller may be pretending to be an authority or bank.",
    signalPressureTactic: "⚠️ The caller may be using threats or pressure.",

    // Easy Mode Landing / Guide
    welcomeTitle: "VIRA Phone Safety",
    welcomeSubtitle: "Protecting you from AI voice scams and fraud calls in real time.",
    rule1Title: "Never share your OTP or PIN",
    rule1Desc: "Real banks, police, or companies will never ask for your passwords, OTP, or PIN on a phone call.",
    rule2Title: "Verify Before You Transfer",
    rule2Desc: "If a caller claims a family emergency and asks for money, hang up and call your relative directly on their known number.",
    rule3Title: "Beware of Fake AI Voices",
    rule3Desc: "Scammers can now clone familiar voices using AI computers. VIRA checks incoming audio to spot synthetic speech.",
    reportAdviceTitle: "Report Suspicious Calls",
    reportAdviceDesc: "If a caller threatens you or asks for money, hang up immediately. Do not stay on the line.",
    testCallPrompt: "Make a safe call to any contact with live voice protection.",
    learnMoreTechnical: "Want deep technical details? Exit Easy Mode anytime to see the full forensic dashboard.",

    // Spoken Summaries for Listen Button
    landingSpokenSummary:
      "Welcome to VIRA Phone Safety. VIRA protects you from fake computer voices and phone scams. Remember rule number one: never share your OTP, PIN, or password with anyone over the phone. Rule number two: if someone asks for urgent money, hang up and call them back on their real number. VIRA checks caller voices in real time to keep you safe.",
    callSpokenSafe:
      "Call status: connected. Voice safety: likely a real person. Risk level: low. Remember, never share your OTP or password over a call.",
    callSpokenWarning:
      "Attention! VIRA has detected potential warnings on this call. The voice may be computer generated, or the caller may be asking for money or sensitive information. Do not share any OTP or transfer money.",
    callSpokenHighRisk:
      "Danger! High risk detected on this call. Suspicious patterns and threat signals detected. Hang up immediately and do not share any financial or personal details.",

    // Authentication Page
    authSubtitle: "Real-time voice integrity and speaker authentication.",
    authBackLink: "Back to VIRA Overview",
    continueWithGoogle: "Continue with Google",
    connectingGoogle: "Connecting to Google...",
    orDivider: "or",
    authSignInTab: "Sign In",
    authRegisterTab: "Register",
    authEmailLabel: "Email",
    authEmailPlaceholder: "name@example.com",
    authPasswordLabel: "Password",
    authPasswordPlaceholderLogin: "••••••••••••",
    authPasswordPlaceholderRegister: "Minimum 8 characters",
    authDisplayNameLabel: "Display Name",
    authDisplayNamePlaceholder: "Your name",
    authSignInBtn: "Sign In",
    authSigningInBtn: "Signing in...",
    authCreateAccountBtn: "Create Account",
    authCreatingAccountBtn: "Creating account...",
    authSuccessTitle: "Authentication successful",
    authSuccessDesc: "Entering VIRA...",
    authShowPassword: "Show password",
    authHidePassword: "Hide password",
    authEmailRequired: "Email is required",
    authEmailInvalid: "Please enter a valid email address",
    authPasswordRequired: "Password is required",
    authPasswordTooShort: "Password must be at least 8 characters",
    authDisplayNameRequired: "Display name is required",
    authDisplayNameTooShort: "Display name must be at least 2 characters",
    authDisplayNameTooLong: "Display name must be 50 characters or less",
    authForgotPassword: "Forgot password?",
    authDontHaveAccount: "Don't have an account?",
    authAlreadyHaveAccount: "Already have an account?",
    authContinue: "Continue",
  },

  hi: {
    // Navigation & General
    easyMode: "Easy Mode",
    exitEasyMode: "Easy Mode बंद करें",
    chooseLanguage: "भाषा चुनें",
    chooseLanguageTitle: "भाषा चुनें / Choose Language",
    chooseLanguagePrompt: "Easy Mode के लिए अपनी पसंदीदा भाषा चुनें:",
    english: "English",
    hindi: "हिंदी",
    signIn: "साइन इन",
    signUp: "साइन अप",
    logout: "लॉग आउट",
    profile: "प्रोफ़ाइल",
    home: "होम",
    contacts: "कॉन्टैक्ट्स",
    back: "वापस जाएं",

    // Audio / Speech Synthesis
    listen: "सुनें",
    stop: "रोकें",
    listening: "बोलकर सुनाया जा रहा है...",
    speechNotSupported: "इस डिवाइस या ब्राउज़र पर बोलकर सुनाने की सुविधा उपलब्ध नहीं है।",

    // Calls
    startCall: "कॉल शुरू करें",
    endCall: "कॉल समाप्त करें",
    call: "कॉल करें",
    calling: "कॉल जा रही है...",
    ringing: "घंटी बज रही है...",
    connecting: "कॉल जुड़ रही है...",
    connected: "कॉल कनेक्टेड है",
    callEnded: "कॉल समाप्त हो गई",
    mute: "म्यूट",
    unmute: "अनम्यूट",
    speaking: "बोल रहे हैं...",
    online: "उपलब्ध",
    offline: "ऑफ़लाइन",

    // Voice & Security Concepts
    voiceSafety: "आवाज़ की सुरक्षा",
    riskLevel: "जोखिम स्तर",
    whyFlagged: "इसे चेतावनी क्यों मिली?",
    verifyBeforeTransfer: "पैसे भेजने से पहले सत्यापित करें",
    neverShareOtp: "अपना OTP या PIN कभी साझा न करें",
    reportSuspicious: "संदिग्ध कॉल की रिपोर्ट करें",
    moreDetails: "अधिक जानकारी",
    hideDetails: "जानकारी छुपाएं",
    technicalDetails: "तकनीकी विवरण",

    // Call Recording & Safety Actions
    record: "रिकॉर्ड करें",
    stopRecording: "रिकॉर्डिंग रोकें",
    recording: "रिकॉर्डिंग जारी है...",
    recordingSaved: "रिकॉर्डिंग डिवाइस पर सेव हो गई।",
    playRecording: "चलाएं",
    pauseRecording: "रोकें",
    playback: "रिकॉर्डिंग सुनें",
    downloadRecording: "डाउनलोड करें",
    reportScamCall: "स्कैम कॉल रिपोर्ट करें",
    callReported: "कॉल को संदिग्ध के रूप में चिह्नित किया गया।",
    whyViraFlagged: "VIRA ने चेतावनी क्यों दी?",
    whyViraFlaggedTitle: "VIRA ने इस कॉल को चेतावनी क्यों दी",
    noReasonEvidence: "VIRA के पास कोई विशिष्ट कारण बताने के लिए पर्याप्त प्रमाण नहीं हैं।",
    recordings: "रिकॉर्डिंग्स",
    callRecordings: "कॉल रिकॉर्डिंग्स",
    noRecordings: "अभी तक कोई रिकॉर्डिंग सहेजी नहीं गई है।",
    delete: "हटाएं",
    deleteRecording: "रिकॉर्डिंग हटाएं",
    deleteConfirm: "क्या आप इस रिकॉर्डिंग को हटाना चाहते हैं?",
    storageFull: "रिकॉर्डिंग सहेजने में असमर्थ। डिवाइस मेमोरी भरी हुई है।",
    duration: "अवधि",
    size: "आकार",
    localPrivacyNotice: "रिकॉर्डिंग्स केवल आपके डिवाइस पर सुरक्षित रहती हैं और कभी अपलोड नहीं की जाती हैं।",

    // Launching Soon Experience
    launchingSoon: "जल्द आ रहा है",
    launchingSoonTitle: "VIRA आपके लिए तैयार हो रहा है।",
    launchingSoonSubtitle: "उन्नत voice integrity और secure calling सुविधाएँ जल्द उपलब्ध होंगी।",
    launchingSoonAccountReady: "खाता सत्यापित",
    launchingSoonAccountDesc: "आपका खाता सक्रिय है। पूर्ण वॉइस सुरक्षा और कॉलिंग सुविधाएँ जल्द ही अनलॉक होंगी।",
    launchingSoonSpoken: "VIRA आपके लिए तैयार हो रहा है। उन्नत voice integrity और secure calling सुविधाएँ जल्द उपलब्ध होंगी। आपका खाता सत्यापित हो चुका है।",

    // Statuses
    waitingForAnalysis: "विश्लेषण की प्रतीक्षा है",
    analysisUnavailable: "विश्लेषण उपलब्ध नहीं है",
    evaluatingVoice: "आवाज़ की जांच हो रही है...",
    safeVoice: "संभवतः असली आवाज़",
    safeVoiceDesc: "कॉलर की आवाज़ में प्राकृतिक मानवीय लक्षण पाए गए हैं।",
    aiVoiceWarning: "चेतावनी: कंप्यूटर की आवाज़ हो सकती है",
    aiVoiceWarningDesc: "कॉलर की आवाज़ कंप्यूटर या AI क्लोनिंग द्वारा बनाई गई हो सकती है।",
    mismatchWarning: "चेतावनी: आवाज़ कॉन्टैक्ट से मेल नहीं खाती",
    mismatchWarningDesc: "आवाज़ इंसान की है, लेकिन आपके सेव किए गए कॉन्टैक्ट की आवाज़ से अलग है।",
    unverifiedVoice: "असत्यापित आवाज़",
    unverifiedVoiceDesc: "इस कॉन्टैक्ट का पुराना वॉइस रिकॉर्ड उपलब्ध नहीं है।",

    // Risk Levels
    lowRisk: "कम (सुरक्षित)",
    lowRiskDesc: "सामान्य बातचीत। कोई खतरा नहीं मिला।",
    mediumRisk: "मध्यम (सावधान रहें)",
    mediumRiskDesc: "बातचीत में संदिग्ध बातें देखी गईं। सावधानी बरतें।",
    highRisk: "उच्च खतरा!",
    highRiskDesc: "इस कॉल पर धोखाधड़ी या पैसे ऐंठने का गंभीर खतरा है।",

    // Social Engineering Signal Warnings
    signalMoneyRequest: "💸 कॉलर पैसे के बारे में बात कर रहा है।",
    signalUrgency: "⏱️ कॉलर आपको जल्दबाजी कराने की कोशिश कर सकता है।",
    signalCredentialRequest: "🔐 कोई आपसे गुप्त जानकारी (OTP या PIN) मांग सकता है।",
    signalImpersonation: "🏛️ कॉलर बैंक या किसी सरकारी अधिकारी का दिखावा कर सकता है।",
    signalPressureTactic: "⚠️ कॉलर दबाव या धमकी देने की कोशिश कर सकता है।",

    // Easy Mode Landing / Guide
    welcomeTitle: "वीरा (VIRA) फोन सुरक्षा",
    welcomeSubtitle: "नकली AI आवाज़ और फोन फ्रॉड से आपकी तुरंत और आसान सुरक्षा।",
    rule1Title: "अपना OTP या PIN कभी साझा न करें",
    rule1Desc: "कोई भी असली बैंक, पुलिस या कंपनी फोन पर आपसे कभी भी पासवर्ड, OTP या PIN नहीं मांगती।",
    rule2Title: "पैसे भेजने से पहले सत्यापित करें",
    rule2Desc: "अगर कोई कहे कि रिश्तेदार किसी मुसीबत में है और तुरंत पैसे मांगे, तो फोन काटें और रिश्तेदार के असली नंबर पर फोन करके पुष्टि करें।",
    rule3Title: "नकली AI आवाज़ों से सावधान रहें",
    rule3Desc: "धोखेबाज अब कंप्यूटर से परिचित लोगों की आवाज़ की नकल कर सकते हैं। वीरा कंप्यूटर की आवाज़ को पहचान कर आपको चेतावनी देता है।",
    reportAdviceTitle: "संदिग्ध कॉल की रिपोर्ट करें",
    reportAdviceDesc: "अगर कोई आपको फोन पर डराए या पैसे मांगे, तो तुरंत फोन काट दें। बात आगे न बढ़ाएं।",
    testCallPrompt: "किसी भी कॉन्टैक्ट को सुरक्षित कॉल करें और लाइव सुरक्षा जांच देखें।",
    learnMoreTechnical: "तकनीकी विवरण देखना चाहते हैं? कभी भी Easy Mode बंद करके पूरा विवरण देख सकते हैं।",

    // Spoken Summaries for Listen Button
    landingSpokenSummary:
      "वीरा फोन सुरक्षा में आपका स्वागत है। वीरा आपको नकली कंप्यूटर आवाज़ और फोन फ्रॉड से सुरक्षित रखता है। नियम नंबर एक: फोन पर कभी भी अपना OTP, PIN या पासवर्ड किसी को न बताएं। नियम नंबर दो: अगर कोई इमरजेंसी बताकर पैसे मांगे, तो फोन काटें और उनके असली नंबर पर दोबारा कॉल करके जांचें। वीरा कॉल के दौरान आपकी सुरक्षा की निगरानी करता है।",
    callSpokenSafe:
      "कॉल कनेक्टेड है। आवाज़ की सुरक्षा: संभवतः असली इंसान की आवाज़ है। जोखिम स्तर कम और सुरक्षित है। याद रखें, फोन पर कभी भी OTP या पासवर्ड साझा न करें।",
    callSpokenWarning:
      "सावधान! इस कॉल पर चेतावनी मिली है। यह आवाज़ कंप्यूटर से बनाई हुई हो सकती है, या कॉलर पैसे या गुप्त जानकारी मांग रहा है। कोई भी OTP या पैसे न भेजें।",
    callSpokenHighRisk:
      "खतरा! इस कॉल पर उच्च जोखिम पाया गया है। संदिग्ध और डराने-धमकाने वाली बातें दर्ज हुई हैं। तुरंत फोन काट दें और कोई भी जानकारी न दें।",

    // Authentication Page
    authSubtitle: "रीयल-टाइम आवाज़ सुरक्षा और कॉलर सत्यापन।",
    authBackLink: "मुख्य पेज पर वापस जाएं",
    continueWithGoogle: "Google के साथ आगे बढ़ें",
    connectingGoogle: "Google से जुड़ रहा है...",
    orDivider: "या",
    authSignInTab: "साइन इन",
    authRegisterTab: "नया खाता",
    authEmailLabel: "ईमेल आईडी",
    authEmailPlaceholder: "name@example.com",
    authPasswordLabel: "पासवर्ड",
    authPasswordPlaceholderLogin: "••••••••••••",
    authPasswordPlaceholderRegister: "कम से कम 8 अक्षर",
    authDisplayNameLabel: "आपका नाम",
    authDisplayNamePlaceholder: "अपना नाम दर्ज करें",
    authSignInBtn: "साइन इन करें",
    authSigningInBtn: "साइन इन हो रहा है...",
    authCreateAccountBtn: "नया खाता बनाएं",
    authCreatingAccountBtn: "खाता बन रहा है...",
    authSuccessTitle: "सत्यापन सफल रहा",
    authSuccessDesc: "वीरा में प्रवेश हो रहा है...",
    authShowPassword: "पासवर्ड देखें",
    authHidePassword: "पासवर्ड छुपाएं",
    authEmailRequired: "ईमेल आईडी भरना ज़रूरी है",
    authEmailInvalid: "कृपया सही ईमेल पता दर्ज करें",
    authPasswordRequired: "पासवर्ड भरना ज़रूरी है",
    authPasswordTooShort: "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए",
    authDisplayNameRequired: "अपना नाम भरना ज़रूरी है",
    authDisplayNameTooShort: "नाम कम से कम 2 अक्षरों का होना चाहिए",
    authDisplayNameTooLong: "नाम 50 अक्षरों से अधिक नहीं हो सकता",
    authForgotPassword: "पासवर्ड भूल गए?",
    authDontHaveAccount: "खाता नहीं है?",
    authAlreadyHaveAccount: "पहले से खाता है?",
    authContinue: "आगे बढ़ें",
  },
};
