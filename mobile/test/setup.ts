// Native modules the tree touches at mount. Jest runs on Node, where none of
// them exist; stubbing is what lets the render itself be the thing under test.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    multiGet: jest.fn(async (keys: string[]) => keys.map((k) => [k, null])),
    setItem: jest.fn(async () => undefined),
    getItem: jest.fn(async () => null),
  },
}));

// The auth flow reaches for the app manifest to build its redirect URI, which
// Node has no equivalent of. Stubbed because the subject here is whether the
// tree mounts, not whether Auth0 answers.
jest.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "erickmarket://redirect",
  ResponseType: { Code: "code" },
  AuthRequest: class {
    codeVerifier = "test-verifier";
    async makeAuthUrlAsync() {
      return "https://example.test/authorize";
    }
    async promptAsync() {
      return { type: "dismiss" as const };
    }
  },
}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: "dismiss" })),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { apiBase: "https://example.test" } } },
}));
