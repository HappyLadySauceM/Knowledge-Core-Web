import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible action", () => {
    render(<Button>Open Studio</Button>);
    expect(screen.getByRole("button", { name: "Open Studio" })).toBeVisible();
  });
});
