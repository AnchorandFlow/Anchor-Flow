/**
 * classifyRefreshError — the decision function refreshAuthToken() (App.jsx)
 * uses to tell an invalid/already-used refresh token apart from a transient
 * network failure. Only the former should force the zombie-session reauth
 * lockout; the latter must keep the existing silent-retry behavior.
 */

import { describe, it, expect } from "vitest";
import { classifyRefreshError } from "../../src/auth/classifyRefreshError.js";

describe("classifyRefreshError", () => {
  it("classifies an already-used refresh token as reauth", () => {
    expect(classifyRefreshError({ message: "Invalid Refresh Token: Already Used", status: 400 })).toBe("reauth");
  });

  it("classifies a revoked/invalid refresh token as reauth", () => {
    expect(classifyRefreshError({ message: "Invalid Refresh Token", status: 401 })).toBe("reauth");
  });

  it("classifies common network-failure messages as retry", () => {
    expect(classifyRefreshError({ message: "Failed to fetch" })).toBe("retry");
    expect(classifyRefreshError(new TypeError("NetworkError when attempting to fetch resource."))).toBe("retry");
    expect(classifyRefreshError({ message: "The operation timed out." })).toBe("retry");
    expect(classifyRefreshError({ message: "Network request failed" })).toBe("retry");
  });

  it("classifies no error as ok", () => {
    expect(classifyRefreshError(null)).toBe("ok");
    expect(classifyRefreshError(undefined)).toBe("ok");
  });

  it("defaults unrecognized errors to reauth (safe default, matches prior behavior)", () => {
    expect(classifyRefreshError({ message: "Some unexpected server error" })).toBe("reauth");
    expect(classifyRefreshError("plain string error")).toBe("reauth");
  });
});
