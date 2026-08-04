/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base del backend (p. ej. http://localhost:10000). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
