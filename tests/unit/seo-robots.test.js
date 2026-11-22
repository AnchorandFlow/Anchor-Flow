// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { applyRobotsForSession, PUBLIC_ROBOTS, PRIVATE_ROBOTS } from "../../src/lib/seoRobots.js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

describe("seoRobots", function () {
  it("noindexes signed-in screens and re-indexes the sign-in screen", function () {
    applyRobotsForSession(true);
    expect(document.head.querySelector('meta[name="robots"]').getAttribute("content")).toBe(PRIVATE_ROBOTS);
    expect(document.head.querySelectorAll('meta[name="robots"]').length).toBe(1);
    applyRobotsForSession(false);
    expect(document.head.querySelector('meta[name="robots"]').getAttribute("content")).toBe(PUBLIC_ROBOTS);
    expect(document.title).toMatch(/Sign In/);
  });
  it("index.html carries title, description, canonical and share tags", function () {
    var html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    ["<title>", 'name="description"', 'rel="canonical"', 'og:image" content="https://www.anchorandflowapp.com/og-image.png"', 'twitter:card', 'name="robots" content="index']
      .forEach(function (t) { expect(html).toContain(t); });
  });
});
