// friendlyError — every user-facing error is a plain sentence with a next step;
// raw detail (JSON bodies, status codes, provider messages) stays in the console.
import { describe, it, expect, vi } from "vitest";
import { friendlyError, friendlyMessage, errorKind, userError } from "../../src/lib/friendlyError.js";

function http(body, status) { var e = new Error(typeof body === "string" ? body : JSON.stringify(body)); e.status = status; return e; }

describe("friendlyError", function () {
  it("gives the requested example wording", function () {
    expect(friendlyMessage(new TypeError("Failed to fetch"), "save")).toBe("Couldn't save — check your connection and try again.");
    expect(friendlyMessage(http({ error: "reconnect" }, 401), "gcal")).toBe("Google sign-in expired — tap Reconnect.");
    expect(friendlyMessage(http("overloaded", 429), "compass")).toBe("Compass is busy right now — try again in a minute.");
  });
  it("maps sign-in failures", function () {
    expect(friendlyMessage(http({ error: "invalid_grant", error_description: "Invalid login credentials" }, 400), "signin")).toMatch(/Incorrect email or password/);
    expect(friendlyMessage(http({ msg: "Email not confirmed" }, 400), "signin")).toMatch(/confirm your email/);
    expect(friendlyMessage(http({ msg: "User already registered" }, 422), "signup")).toMatch(/already has an account/);
  });
  it("maps checkout failures and says no charge", function () {
    expect(friendlyMessage(new Error("not signed in"), "checkout")).toBe("Please sign in again, then tap Upgrade.");
    expect(friendlyMessage(http("No such price: price_123", 500), "checkout")).toMatch(/haven't been charged/);
  });
  it("prefers a curated userMessage", function () {
    expect(friendlyMessage(userError("Compass is turned off — switch it on in Settings to use it."), "compass")).toMatch(/turned off/);
  });
  it("never leaks raw text, JSON or codes", function () {
    var raws = [http({ code: "PGRST301", message: "JWT expired" }, 401), http({ error: "server_error", detail: { x: 1 } }, 500),
      http("<html>502 Bad Gateway</html>", 502), new SyntaxError("Unexpected token < in JSON at position 0"),
      new Error("new row violates row-level security policy for table \"households\""), null, undefined, "boom", { weird: true }];
    ["save", "sync", "signin", "signup", "checkout", "compass", "upload", "gcal", "household", "restore", "nope"].forEach(function (ctx) {
      raws.forEach(function (r) {
        var t = friendlyMessage(r, ctx);
        expect(t).not.toMatch(/[{}<>"]|JWT|PGRST|SyntaxError|row-level|502|500|401|server_error|boom/);
        expect(t).toMatch(/[.]$/);
      });
    });
  });
  it("logs raw detail to the console only", function () {
    var spy = vi.spyOn(console, "warn").mockImplementation(function () {});
    var t = friendlyError(http({ error: "refresh_failed" }, 502), "sync");
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0].join(" "))).toContain("refresh_failed");
    expect(t).not.toContain("refresh_failed");
    spy.mockRestore();
  });
  it("classifies", function () {
    expect(errorKind(Object.assign(new Error("x"), { name: "AbortError" }))).toBe("timeout");
    expect(errorKind(http("", 413))).toBe("tooLarge");
    expect(errorKind(Object.assign(new Error("x"), { name: "QuotaExceededError" }))).toBe("storageFull");
  });
});
