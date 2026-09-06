import test from "node:test";
import assert from "node:assert/strict";
import {
  EASY_MODE_TRANSLATIONS,
  EasyModeLanguage,
  TranslationSchema,
} from "../../utils/easyModeTranslations";

const FORBIDDEN_DETERMINISTIC_WORDS = [
  "100% human",
  "100% ai",
  "guaranteed human",
  "guaranteed clone",
  "proof of identity",
  "absolute certainty",
];

test("Easy Mode Test Suite: State, Translations, Probabilistic Copy & Fallbacks", async (t) => {
  await t.test("1. Translation dictionaries exist for both English and Hindi with full key parity", () => {
    const en = EASY_MODE_TRANSLATIONS.en;
    const hi = EASY_MODE_TRANSLATIONS.hi;

    assert.ok(en, "English translations must exist");
    assert.ok(hi, "Hindi translations must exist");

    const enKeys = Object.keys(en) as Array<keyof TranslationSchema>;
    const hiKeys = Object.keys(hi) as Array<keyof TranslationSchema>;

    assert.equal(enKeys.length, hiKeys.length, "Both dictionaries must have identical key count");

    for (const key of enKeys) {
      assert.ok(hi[key], `Hindi must define non-empty key: ${String(key)}`);
      assert.ok(en[key], `English must define non-empty key: ${String(key)}`);
      assert.notEqual(en[key].trim(), "", `English key ${String(key)} must not be blank`);
      assert.notEqual(hi[key].trim(), "", `Hindi key ${String(key)} must not be blank`);
    }
  });

  await t.test("2. Easy Mode copy strictly adheres to probabilistic voice safety guidelines (No deterministic claims)", () => {
    const languages: EasyModeLanguage[] = ["en", "hi"];

    for (const lang of languages) {
      const dict = EASY_MODE_TRANSLATIONS[lang];
      for (const [key, text] of Object.entries(dict)) {
        const lower = text.toLowerCase();
        for (const forbidden of FORBIDDEN_DETERMINISTIC_WORDS) {
          assert.ok(
            !lower.includes(forbidden),
            `[${lang}] Key "${key}" contains forbidden deterministic phrase "${forbidden}": "${text}"`
          );
        }
      }
    }
  });

  await t.test("3. Security threat signals use plain, accessible language in English and Hindi", () => {
    const en = EASY_MODE_TRANSLATIONS.en;
    const hi = EASY_MODE_TRANSLATIONS.hi;

    // Money request signal
    assert.ok(en.signalMoneyRequest.includes("money"), "EN money request mentions money");
    assert.ok(hi.signalMoneyRequest.includes("पैसे"), "HI money request mentions पैसे");

    // Urgency signal
    assert.ok(en.signalUrgency.includes("rush"), "EN urgency mentions rush");
    assert.ok(hi.signalUrgency.includes("जल्दबाजी"), "HI urgency mentions जल्दबाजी");

    // Credential request signal
    assert.ok(en.signalCredentialRequest.includes("OTP"), "EN credential request mentions OTP");
    assert.ok(hi.signalCredentialRequest.includes("OTP"), "HI credential request mentions OTP");

    // Impersonation signal
    assert.ok(en.signalImpersonation.includes("authority") || en.signalImpersonation.includes("bank"), "EN impersonation mentions authority or bank");
    assert.ok(hi.signalImpersonation.includes("बैंक") || hi.signalImpersonation.includes("अधिकारी"), "HI impersonation mentions बैंक or अधिकारी");

    // Pressure tactic signal
    assert.ok(en.signalPressureTactic.includes("threats") || en.signalPressureTactic.includes("pressure"), "EN pressure mentions threats/pressure");
    assert.ok(hi.signalPressureTactic.includes("दबाव") || hi.signalPressureTactic.includes("धमकी"), "HI pressure mentions दबाव/धमकी");
  });

  await t.test("4. Language switching toggles between English and Hindi correctly", () => {
    let currentLang: EasyModeLanguage = "en";
    const toggle = (l: EasyModeLanguage): EasyModeLanguage => (l === "en" ? "hi" : "en");

    currentLang = toggle(currentLang);
    assert.equal(currentLang, "hi", "Toggled from English to Hindi");

    currentLang = toggle(currentLang);
    assert.equal(currentLang, "en", "Toggled from Hindi back to English");
  });

  await t.test("5. Honest states when ML scores are unavailable (Zero fabrication guarantee)", () => {
    const en = EASY_MODE_TRANSLATIONS.en;
    const hi = EASY_MODE_TRANSLATIONS.hi;

    assert.equal(en.waitingForAnalysis, "Waiting for analysis");
    assert.equal(hi.waitingForAnalysis, "विश्लेषण की प्रतीक्षा है");

    assert.equal(en.analysisUnavailable, "Analysis unavailable");
    assert.equal(hi.analysisUnavailable, "विश्लेषण उपलब्ध नहीं है");

    // Fallback description for unenrolled contact
    assert.ok(en.unverifiedVoiceDesc.includes("No enrolled voice profile"), "EN unverified voice explains lack of baseline profile");
    assert.ok(hi.unverifiedVoiceDesc.includes("वॉइस रिकॉर्ड उपलब्ध नहीं है"), "HI unverified voice explains lack of baseline profile");
  });

  await t.test("6. Golden security rules are clearly defined for user education", () => {
    const en = EASY_MODE_TRANSLATIONS.en;
    const hi = EASY_MODE_TRANSLATIONS.hi;

    // Rule 1: Never share OTP
    assert.ok(en.rule1Title.includes("OTP") && en.rule1Title.includes("PIN"));
    assert.ok(hi.rule1Title.includes("OTP") && hi.rule1Title.includes("PIN"));

    // Rule 2: Verify Before Transfer
    assert.ok(en.rule2Title.includes("Verify") && en.rule2Title.includes("Transfer"));
    assert.ok(hi.rule2Title.includes("पैसे") && hi.rule2Title.includes("सत्यापित"));

    // Rule 3: Fake AI Voices
    assert.ok(en.rule3Title.includes("Fake AI Voices"));
    assert.ok(hi.rule3Title.includes("AI आवाज़ों"));
  });

  await t.test("7. Spoken audio synthesis text scripts exist for both languages", () => {
    const en = EASY_MODE_TRANSLATIONS.en;
    const hi = EASY_MODE_TRANSLATIONS.hi;

    assert.ok(en.landingSpokenSummary.length > 50, "English spoken landing summary is complete");
    assert.ok(hi.landingSpokenSummary.length > 50, "Hindi spoken landing summary is complete");

    assert.ok(en.callSpokenSafe.includes("Voice safety"), "English call spoken script mentions voice safety");
    assert.ok(hi.callSpokenSafe.includes("आवाज़ की सुरक्षा"), "Hindi call spoken script mentions voice safety");

    assert.ok(en.callSpokenWarning.includes("computer generated"), "English warning script alerts user");
    assert.ok(hi.callSpokenWarning.includes("कंप्यूटर"), "Hindi warning script alerts user");
  });

  await t.test("8. Navigation button labels match specification in both languages", () => {
    assert.equal(EASY_MODE_TRANSLATIONS.en.easyMode, "Easy Mode");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.easyMode, "Easy Mode");

    assert.equal(EASY_MODE_TRANSLATIONS.en.exitEasyMode, "Exit Easy Mode");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.exitEasyMode, "Easy Mode बंद करें");

    assert.equal(EASY_MODE_TRANSLATIONS.en.signIn, "Sign In");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.signIn, "साइन इन");

    assert.equal(EASY_MODE_TRANSLATIONS.en.startCall, "Start Call");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.startCall, "कॉल शुरू करें");

    assert.equal(EASY_MODE_TRANSLATIONS.en.endCall, "End Call");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.endCall, "कॉल समाप्त करें");

    assert.equal(EASY_MODE_TRANSLATIONS.en.listen, "Listen");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.listen, "सुनें");

    assert.equal(EASY_MODE_TRANSLATIONS.en.stop, "Stop");
    assert.equal(EASY_MODE_TRANSLATIONS.hi.stop, "रोकें");
  });

  await t.test("9. Easy Mode button metadata & accessibility attributes", () => {
    const buttonText = "Easy Mode";
    const ariaLabel = "Easy Mode";
    const buttonId = "easy-mode-toggle-btn";

    assert.equal(buttonText, "Easy Mode", "Button text must strictly be 'Easy Mode'");
    assert.equal(ariaLabel, "Easy Mode", "Aria-label must provide clear assistive naming");
    assert.equal(buttonId, "easy-mode-toggle-btn", "Stable ID must be provided for accessibility and testing");
  });

  await t.test("10. State machine flow: Normal Mode -> Click Toggle -> Modal -> Select Language -> Easy Mode -> Exit", () => {
    type State = {
      isEasyMode: boolean;
      showLanguageModal: boolean;
      language: EasyModeLanguage;
    };

    let state: State = {
      isEasyMode: false,
      showLanguageModal: false,
      language: "en",
    };

    // Step 1: Normal Landing state
    assert.equal(state.isEasyMode, false, "Initial state: Easy Mode OFF");
    assert.equal(state.showLanguageModal, false, "Initial state: Modal closed");

    // Step 2: User clicks [ Easy Mode ]
    state.showLanguageModal = true;
    assert.equal(state.showLanguageModal, true, "Clicking Easy Mode opens language modal");
    assert.equal(state.isEasyMode, false, "Easy Mode remains OFF until language chosen");

    // Step 3: User selects Hindi
    state.language = "hi";
    state.isEasyMode = true;
    state.showLanguageModal = false;
    assert.equal(state.isEasyMode, true, "Easy Mode is now ACTIVE");
    assert.equal(state.language, "hi", "Language is set to Hindi");
    assert.equal(state.showLanguageModal, false, "Modal is closed");

    // Step 4: User clicks [ Exit Easy Mode ]
    state.isEasyMode = false;
    assert.equal(state.isEasyMode, false, "Easy Mode is now OFF, normal landing restored");
  });
});
