import React from "react";
import { Text } from "react-native";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../lib/auth";

/**
 * The failure this guards against is not a crash — it is silence.
 *
 * `login` used to catch every error and drop it, on the assumption that the
 * only way the browser flow fails is someone backing out. When the flow broke
 * for a real reason the app looked identical to a cancelled sign-in: back to
 * the login button, nothing said. Days went into guessing at what the device
 * already knew.
 */
let mockAuthorize: () => Promise<void>;

// The shared stub deliberately ships no Auth0 credentials, which makes
// `login` a no-op. Sign-in is the subject here, so this file supplies them.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiBase: "https://example.test",
        auth0Domain: "example.us.auth0.com",
        auth0ClientId: "test-client-id",
        auth0Audience: "https://example.test/api",
      },
    },
  },
}));

jest.mock("react-native-auth0", () => ({
  Auth0Provider: ({ children }: { children: React.ReactNode }) => children,
  useAuth0: () => ({
    authorize: () => mockAuthorize(),
    clearSession: jest.fn(async () => undefined),
    getCredentials: jest.fn(async () => undefined),
    user: null,
    isLoading: false,
  }),
}));

const Probe: React.FC = () => {
  const { login, loginError } = useAuth();
  return (
    <>
      <Text testID="err">{loginError ?? "none"}</Text>
      <Text testID="go" onPress={() => void login()}>
        go
      </Text>
    </>
  );
};

/** Let RNTL own the act() scope; nesting our own overlaps with render's. */
const press = async (expected: string) => {
  fireEvent.press(screen.getByTestId("go"));
  await waitFor(() => expect(shown()).toBe(expected));
};

const signIn = async (expected: string) => {
  // Awaited on purpose: under React 19 this render is asynchronous, and an
  // un-awaited one leaves `screen` empty until something else yields.
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  await press(expected);
};

const shown = () => screen.getByTestId("err").props.children;

it("surfaces a real failure with the SDK's own wording", async () => {
  mockAuthorize = async () => {
    throw { name: "a0.invalid_configuration", message: "Missing DPoP proof" };
  };

  await signIn("a0.invalid_configuration: Missing DPoP proof");
});

it("stays quiet when the person backed out of the browser", async () => {
  mockAuthorize = async () => {
    throw { name: "USER_CANCELLED", message: "User cancelled the Auth" };
  };

  await signIn("none");
});

it("clears a previous failure when trying again", async () => {
  mockAuthorize = async () => {
    throw { name: "a0.network_error", message: "unreachable" };
  };
  await signIn("a0.network_error: unreachable");

  mockAuthorize = async () => undefined;
  await press("none");
});
