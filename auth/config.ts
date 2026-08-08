export function isAuth0Configured(): boolean {
  return Boolean(
    import.meta.env.VITE_AUTH0_DOMAIN &&
      import.meta.env.VITE_AUTH0_CLIENT_ID &&
      import.meta.env.VITE_AUTH0_AUDIENCE,
  );
}

export const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
export const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID as
  | string
  | undefined;
export const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE as
  | string
  | undefined;
