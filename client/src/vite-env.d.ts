/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_VOICE_VERIFICATION_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
