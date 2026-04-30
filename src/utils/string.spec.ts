import { describe, it, expect } from "vitest";
import { escapeHtml } from "./string.js";

describe("escapeHtml", () => {
  it("escapes special HTML characters", () => {
    const input = '<script>alert("XSS & others")</script>';
    const expected = "&lt;script&gt;alert(&quot;XSS &amp; others&quot;)&lt;/script&gt;";
    expect(escapeHtml(input)).toBe(expected);
  });

  it("escapes single quotes", () => {
    const input = "it's a test";
    const expected = "it&#039;s a test";
    expect(escapeHtml(input)).toBe(expected);
  });

  it("leaves normal characters alone", () => {
    const input = "Hello, world!";
    const expected = "Hello, world!";
    expect(escapeHtml(input)).toBe(expected);
  });
});
