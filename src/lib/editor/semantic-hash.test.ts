import { describe, expect, it } from "vitest";
import { publicationSemanticHash } from "@/lib/editor/semantic-hash";

describe("publicationSemanticHash", () => {
  it("is stable for the same authoring state", async () => {
    const input = { title: "Doc", summary: "", slug: "doc", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] }, plainText: "hello" };
    await expect(publicationSemanticHash(input)).resolves.toBe(await publicationSemanticHash(input));
  });

  it("changes for meaningful metadata and blank-line edits", async () => {
    const base = { title: "Doc", summary: "", slug: "doc", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] }, plainText: "hello" };
    const changed = { ...base, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }, { type: "paragraph" }] }, plainText: "hello\n" };
    await expect(publicationSemanticHash(base)).resolves.not.toBe(await publicationSemanticHash(changed));
  });

  it("canonicalizes rich-text object key order", async () => {
    const left = { title: "Doc", summary: "", slug: "doc", content: { type: "doc", content: [{ type: "paragraph", attrs: { z: 1, a: 2 }, content: [{ type: "text", text: "same" }] }] }, plainText: "same" };
    const right = { title: "Doc", summary: "", slug: "doc", content: { content: [{ type: "paragraph", content: [{ type: "text", text: "same" }], attrs: { a: 2, z: 1 } }], type: "doc" }, plainText: "same" };
    await expect(publicationSemanticHash(left)).resolves.toBe(await publicationSemanticHash(right));
  });

  it("ignores stable block ids used only by the history diff", async () => {
    const left = { title: "Doc", summary: "", slug: "doc", content: { type: "doc", content: [{ type: "paragraph", attrs: { blockId: "block-a" }, content: [{ type: "text", text: "same" }] }] }, plainText: "same" };
    const right = { ...left, content: { type: "doc", content: [{ type: "paragraph", attrs: { blockId: "block-b" }, content: [{ type: "text", text: "same" }] }] } };
    await expect(publicationSemanticHash(left)).resolves.toBe(await publicationSemanticHash(right));
  });

  it("uses the first non-empty line when the summary is blank", async () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "first line" }] }] };
    const inferred = { title: "Doc", summary: "", slug: "doc", content, plainText: "first line" };
    const explicit = { ...inferred, summary: "first line" };
    await expect(publicationSemanticHash(inferred)).resolves.toBe(await publicationSemanticHash(explicit));
  });
});
