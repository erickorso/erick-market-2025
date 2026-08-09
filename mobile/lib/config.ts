import Constants from "expo-constants";
import { setApiBase } from "../../services/apiBase";

type Extra = {
  apiBase?: string;
  auth0Domain?: string;
  auth0ClientId?: string;
  auth0Audience?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/**
 * A native app has no origin, so the host is configuration rather than an
 * assumption. It comes from app.json, which means a build can be pointed at a
 * preview deployment without touching a line of code.
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  extra.apiBase ??
  "https://erick-market-2025.vercel.app";

export const AUTH0_DOMAIN =
  process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? extra.auth0Domain ?? "";
export const AUTH0_CLIENT_ID =
  process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? extra.auth0ClientId ?? "";
export const AUTH0_AUDIENCE =
  process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? extra.auth0Audience ?? "";

/** True only when the dashboard work has been done and a build can sign in. */
export const authConfigured = Boolean(AUTH0_DOMAIN && AUTH0_CLIENT_ID);

setApiBase(API_BASE);
