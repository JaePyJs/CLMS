/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_ENABLE_PERFORMANCE_MONITORING?: string;
  readonly VITE_ENABLE_API_TRACKING?: string;
  readonly VITE_ENABLE_RENDER_TRACKING?: string;
  readonly VITE_ENABLE_INTERACTION_TRACKING?: string;
  readonly VITE_PERFORMANCE_SAMPLE_RATE?: string;
  readonly VITE_PERFORMANCE_ENDPOINT?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
