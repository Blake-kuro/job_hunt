import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders a <button> with the secondary / md defaults", () => {
    const html = renderToStaticMarkup(<Button>保存</Button>);
    expect(html).toMatch(/^<button[^>]*data-variant="secondary"[^>]*data-size="md"/);
    expect(html).toContain("border-divider");
    expect(html).toContain(">保存</button>");
  });

  it("asChild merges the button classes onto the child element", () => {
    const html = renderToStaticMarkup(
      <Button asChild variant="primary">
        <a href="/x">去</a>
      </Button>,
    );
    expect(html).toMatch(/^<a [^>]*href="\/x"/);
    expect(html).toMatch(/class="[^"]*bg-accent[^"]*"/);
    expect(html).not.toContain("<button");
    expect(html).toContain(">去</a>");
  });

  it("asChild with blueprint keeps the corner markers inside the child", () => {
    const html = renderToStaticMarkup(
      <Button asChild blueprint>
        <a href="/x">去</a>
      </Button>,
    );
    expect(html).toMatch(/^<a [^>]*class="[^"]*blueprint/);
    expect(html.match(/class="corner/g)).toHaveLength(4);
  });
});
