import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "./rich-text";

describe("RichText", () => {
  it("keeps each empty paragraph as one visible blank line", () => {
    const { container } = render(
      <RichText
        content={[
          { type: "paragraph", content: [{ type: "text", text: "before" }] },
          { type: "paragraph" },
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [{ type: "text", text: "after" }] },
        ]}
      />,
    );

    expect(container.querySelectorAll(".rich-text-empty-paragraph")).toHaveLength(2);
    expect(container.querySelectorAll(".rich-text-empty-paragraph > br")).toHaveLength(2);
    expect(container.textContent).toContain("before");
    expect(container.textContent).toContain("after");
  });

  it("does not mark non-empty paragraphs as blank", () => {
    const { container } = render(
      <RichText content={[{ type: "paragraph", content: [{ type: "text", text: "content" }] }]} />,
    );

    expect(container.querySelector(".rich-text-empty-paragraph")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("content");
  });
});
