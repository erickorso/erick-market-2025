export const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
export const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID as
  | string
  | undefined;

/** Custom API identifier, or Client ID when no Auth0 API could be created. */
export const auth0Audience = (import.meta.env.VITE_AUTH0_AUDIENCE ||
  import.meta.env.VITE_AUTH0_CLIENT_ID) as string | undefined;

export const auth0UsesCustomApi = Boolean(
  auth0Audience && auth0ClientId && auth0Audience !== auth0ClientId,
);

export function isAuth0Configured(): boolean {
  return Boolean(auth0Domain && auth0ClientId);
}
