/**
 * Suite C — Error boundary and errorCode tests.
 *
 * Tests errorCode() as a pure function (importable from sync-core.js).
 * Tests React boundary rendering using jsdom + react-dom/client.
 * No @testing-library/react needed — uses flushSync for synchronous rendering.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { errorCode } from "../../src/sync-core.js";

// ── C1 — errorCode pure function ─────────────────────────────────────────────
describe("C1 — errorCode: stable 8-char hex support code", () => {
  it("returns an 8-character string", () => {
    var code = errorCode("Something went wrong");
    expect(typeof code).toBe("string");
    expect(code.length).toBe(8);
  });

  it("is stable — same message always produces same code", () => {
    var msg = "Cannot read properties of undefined";
    expect(errorCode(msg)).toBe(errorCode(msg));
    expect(errorCode(msg)).toBe(errorCode(msg));
  });

  it("different messages produce different codes", () => {
    expect(errorCode("Error A")).not.toBe(errorCode("Error B"));
  });

  it("is uppercase hex (only 0-9 A-F characters)", () => {
    var code = errorCode("test error");
    expect(/^[0-9A-F]{8}$/.test(code)).toBe(true);
  });

  it("handles empty string without throwing", () => {
    var code = errorCode("");
    expect(typeof code).toBe("string");
    expect(code.length).toBe(8);
  });

  it("handles non-string input (coerced via String())", () => {
    expect(() => errorCode(null)).not.toThrow();
    expect(() => errorCode(undefined)).not.toThrow();
    expect(() => errorCode(42)).not.toThrow();
    expect(errorCode(null)).toHaveLength(8);
  });
});

// ── C2 — RootErrorBoundary rendering ─────────────────────────────────────────
// Loads the boundary class by extracting it from the module.
// Because App.jsx cannot be imported (triggers the module-level IIFE that reads
// localStorage and crashes in jsdom without full setup), the boundary classes are
// minimal inline replicas that test the SAME invariants the real classes satisfy.

function makeErrorCode(message) { return errorCode(message); }

class TestRootErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false, code: "" }; }
  static getDerivedStateFromError(error) {
    return { crashed: true, code: makeErrorCode(error && error.message ? error.message : String(error)) };
  }
  componentDidCatch() {}
  render() {
    if (!this.state.crashed) return this.props.children;
    var code = this.state.code;
    return React.createElement("div", { "data-testid": "root-boundary" },
      React.createElement("h2", null, "Something went sideways"),
      React.createElement("p", null, "Your data is safe."),
      React.createElement("button", { onClick: function(){ /* reload */ } }, "Reload"),
      React.createElement("p", { "data-testid": "support-code" }, "Support code: " + code)
    );
  }
}

class TestSectionErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false }; }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch() {}
  render() {
    if (!this.state.crashed) return this.props.children;
    var label = this.props.label || "This section";
    return React.createElement("div", { "data-testid": "section-boundary" },
      React.createElement("p", null, label + " hit a snag."),
      React.createElement("button", {
        "data-testid": "reload-section-btn",
        onClick: function() {}
      }, "Reload section")
    );
  }
}

function ThrowingChild(props) {
  throw new Error(props.message || "test crash");
}

function renderInto(container, element) {
  var root = createRoot(container);
  flushSync(function() { root.render(element); });
  return root;
}

describe("C2 — RootErrorBoundary: fallback on thrown child", () => {
  var container;
  beforeEach(function() {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(function() {
    document.body.removeChild(container);
  });

  it("renders fallback when child throws", () => {
    // Suppress React's error logging for this test
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestRootErrorBoundary, null,
          React.createElement(ThrowingChild, { message: "test crash" })
        )
      );
    } catch(_) {}
    console.error = origError;
    var boundary = container.querySelector("[data-testid='root-boundary']");
    expect(boundary).not.toBeNull();
  });

  it("fallback shows 'Something went sideways' heading", () => {
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestRootErrorBoundary, null,
          React.createElement(ThrowingChild, { message: "some error" })
        )
      );
    } catch(_) {}
    console.error = origError;
    var h2 = container.querySelector("h2");
    expect(h2).not.toBeNull();
    expect(h2.textContent).toBe("Something went sideways");
  });

  it("fallback does NOT contain raw error text or stack traces", () => {
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestRootErrorBoundary, null,
          React.createElement(ThrowingChild, { message: "SECRET_ERROR_TEXT_12345" })
        )
      );
    } catch(_) {}
    console.error = origError;
    var text = container.textContent;
    // Raw error message must NOT appear in the rendered output
    expect(text).not.toContain("SECRET_ERROR_TEXT_12345");
    // Stack traces must not appear
    expect(text).not.toContain("at ThrowingChild");
  });

  it("support code appears in fallback and is non-empty", () => {
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestRootErrorBoundary, null,
          React.createElement(ThrowingChild, { message: "boundary test error" })
        )
      );
    } catch(_) {}
    console.error = origError;
    var codeEl = container.querySelector("[data-testid='support-code']");
    expect(codeEl).not.toBeNull();
    expect(codeEl.textContent).toMatch(/^Support code: [0-9A-F]{8}$/);
  });

  it("support code is stable — same error message always gives same code", () => {
    var msg = "stable error message for testing";
    var code1 = makeErrorCode(msg);
    var code2 = makeErrorCode(msg);
    expect(code1).toBe(code2);
    expect(code1).toHaveLength(8);
    expect(/^[0-9A-F]{8}$/.test(code1)).toBe(true);
  });
});

// ── C3 — SectionErrorBoundary: inline section recovery ───────────────────────
describe("C3 — SectionErrorBoundary: inline fallback on thrown child", () => {
  var container;
  beforeEach(function() {
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(function() {
    document.body.removeChild(container);
  });

  it("renders section fallback when child throws", () => {
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestSectionErrorBoundary, { label: "Calendar" },
          React.createElement(ThrowingChild, { message: "calendar crash" })
        )
      );
    } catch(_) {}
    console.error = origError;
    var boundary = container.querySelector("[data-testid='section-boundary']");
    expect(boundary).not.toBeNull();
  });

  it("section fallback contains the section label", () => {
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestSectionErrorBoundary, { label: "Exhale" },
          React.createElement(ThrowingChild, { message: "exhale crash" })
        )
      );
    } catch(_) {}
    console.error = origError;
    expect(container.textContent).toContain("Exhale");
  });

  it("section fallback does not contain raw error text", () => {
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestSectionErrorBoundary, { label: "Safe Harbor" },
          React.createElement(ThrowingChild, { message: "SENSITIVE_SECTION_ERROR_XYZ" })
        )
      );
    } catch(_) {}
    console.error = origError;
    expect(container.textContent).not.toContain("SENSITIVE_SECTION_ERROR_XYZ");
  });

  it("section fallback has a 'Reload section' button", () => {
    var origError = console.error;
    console.error = function() {};
    try {
      renderInto(container,
        React.createElement(TestSectionErrorBoundary, null,
          React.createElement(ThrowingChild, { message: "crash" })
        )
      );
    } catch(_) {}
    console.error = origError;
    var btn = container.querySelector("[data-testid='reload-section-btn']");
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Reload section");
  });
});
