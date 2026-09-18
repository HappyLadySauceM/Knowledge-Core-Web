import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const connectedCss = readFileSync(resolve(process.cwd(), "src/app/connected.css"), "utf8");

describe("Studio shell cascade", () => {
  it("keeps the two-column grid on .studio-workspace, not a 250px .studio-shell grid", () => {
    expect(connectedCss).toMatch(/\.studio-workspace\{display:grid;grid-template-columns:240px minmax\(0,1fr\)/);
    expect(globalsCss).toMatch(/\.studio-shell\s*\{\s*display:\s*block;/);
    expect(globalsCss).not.toMatch(/\.studio-shell\s*\{[^}]*grid-template-columns:\s*250px/);
  });

  it("uses a white writing surface without pill-shaped editor chrome", () => {
    expect(globalsCss).toMatch(/\.document-editor-writing\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(globalsCss).toMatch(/\.document-editor-page\s*\{[^}]*background:\s*var\(--surface\)/);
    expect(connectedCss).toMatch(/\.editor-header-actions button\{[^}]*border:0;[^}]*background:transparent/);
    expect(connectedCss).not.toMatch(/\.editor-header-actions button\{[^}]*border:1px solid var\(--line\)/);
  });

  it("pins document actions under the Studio topbar without sticky writing surface", () => {
    expect(globalsCss).toMatch(
      /\.document-editor-page\s*>\s*\.editor-page-heading\s*\{[^}]*position:\s*sticky;[^}]*top:\s*4\.15rem;[^}]*z-index:\s*15/,
    );
    expect(globalsCss).not.toMatch(/\.backend-content\s*\{[^}]*overflow:\s*auto/);
    expect(globalsCss).not.toMatch(/\.document-editor-writing\s*\{[^}]*position:\s*sticky/);
    expect(globalsCss).not.toMatch(/\.document-editor-shell\s*\{[^}]*position:\s*sticky/);
  });
});

