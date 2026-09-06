import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  EasyModeLanguage,
  EASY_MODE_TRANSLATIONS,
  TranslationSchema,
} from "../utils/easyModeTranslations";

const STORAGE_KEY_ACTIVE = "vira_easy_mode_active";
const STORAGE_KEY_LANG = "vira_easy_mode_lang";

interface EasyModeContextType {
  isEasyMode: boolean;
  language: EasyModeLanguage;
  showLanguageModal: boolean;
  isSpeaking: boolean;
  isSpeechSupported: boolean;
  enableEasyMode: () => void;
  disableEasyMode: () => void;
  toggleEasyMode: () => void;
  selectLanguageAndEnable: (lang: EasyModeLanguage) => void;
  setLanguage: (lang: EasyModeLanguage) => void;
  toggleLanguage: () => void;
  closeLanguageModal: () => void;
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  t: (key: keyof TranslationSchema) => string;
}

const EasyModeContext = createContext<EasyModeContextType | null>(null);

export function EasyModeProvider({ children }: { children: ReactNode }) {
  const [isEasyMode, setIsEasyMode] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY_ACTIVE) === "true";
    } catch {
      return false;
    }
  });

  const [language, setLanguageState] = useState<EasyModeLanguage>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_LANG);
      if (stored === "hi" || stored === "en") return stored;
    } catch {
      // Fallback
    }
    return "en";
  });

  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(false);

  // Check speech synthesis support on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSpeechSupported(true);
    }
  }, []);

  // Stop speaking if mode changes or on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [isEasyMode, language]);

  const enableEasyMode = useCallback(() => {
    // Prompt user to choose language (Hindi / English) whenever activating Easy Mode
    setShowLanguageModal(true);
  }, []);

  const selectLanguageAndEnable = useCallback((lang: EasyModeLanguage) => {
    setLanguageState(lang);
    setIsEasyMode(true);
    setShowLanguageModal(false);
    try {
      sessionStorage.setItem(STORAGE_KEY_LANG, lang);
      sessionStorage.setItem(STORAGE_KEY_ACTIVE, "true");
    } catch {
      // Ignore
    }
  }, []);

  const disableEasyMode = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    setIsSpeaking(false);
    setIsEasyMode(false);
    try {
      sessionStorage.setItem(STORAGE_KEY_ACTIVE, "false");
    } catch {
      // Ignore
    }
  }, []);

  const toggleEasyMode = useCallback(() => {
    if (isEasyMode) {
      disableEasyMode();
    } else {
      enableEasyMode();
    }
  }, [isEasyMode, disableEasyMode, enableEasyMode]);

  const setLanguage = useCallback((lang: EasyModeLanguage) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    setIsSpeaking(false);
    setLanguageState(lang);
    try {
      sessionStorage.setItem(STORAGE_KEY_LANG, lang);
    } catch {
      // Ignore
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    const nextLang = language === "en" ? "hi" : "en";
    setLanguage(nextLang);
  }, [language, setLanguage]);

  const closeLanguageModal = useCallback(() => {
    setShowLanguageModal(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      try {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === "hi" ? "hi-IN" : "en-US";
        utterance.rate = language === "hi" ? 0.9 : 0.95; // Slightly slower for clarity

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn("SpeechSynthesis error:", err);
        setIsSpeaking(false);
      }
    },
    [language]
  );

  const t = useCallback(
    (key: keyof TranslationSchema): string => {
      const dict = EASY_MODE_TRANSLATIONS[language] ?? EASY_MODE_TRANSLATIONS.en;
      return dict[key] ?? EASY_MODE_TRANSLATIONS.en[key] ?? "";
    },
    [language]
  );

  return (
    <EasyModeContext.Provider
      value={{
        isEasyMode,
        language,
        showLanguageModal,
        isSpeaking,
        isSpeechSupported,
        enableEasyMode,
        disableEasyMode,
        toggleEasyMode,
        selectLanguageAndEnable,
        setLanguage,
        toggleLanguage,
        closeLanguageModal,
        speakText,
        stopSpeaking,
        t,
      }}
    >
      {children}
    </EasyModeContext.Provider>
  );
}

export function useEasyMode(): EasyModeContextType {
  const context = useContext(EasyModeContext);
  if (!context) {
    throw new Error("useEasyMode must be used within an EasyModeProvider");
  }
  return context;
}
