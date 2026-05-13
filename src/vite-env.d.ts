/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_LIVECHAT_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@livechat/accounts-sdk' {
  export interface AuthorizeResult {
    access_token: string;
    expires_in?: number;
    scope?: string;
    [key: string]: unknown;
  }
  export interface IframeAuthorizeFlow {
    authorize(): Promise<AuthorizeResult | null>;
  }
  export default class AccountsSDK {
    constructor(options: { client_id: string; [key: string]: unknown });
    iframe(): IframeAuthorizeFlow;
  }
}
