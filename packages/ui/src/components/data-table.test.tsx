import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type Column, DataTable } from "./data-table";

interface Row {
  id: string;
  name: string;
}

const columns: Column<Row>[] = [
  { id: "name", header: "名称", cell: (r) => r.name },
  { id: "id", header: "ID", cellClassName: "truncate", cell: (r) => r.id },
];
const rows: Row[] = [{ id: "1", name: "甲" }];
const render = (props: Partial<React.ComponentProps<typeof DataTable<Row>>>) =>
  renderToStaticMarkup(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption="表" {...props} />);

describe("DataTable", () => {
  it("默认 table-fixed、单元格可换行、容器带内边距", () => {
    const html = render({});
    expect(html).toContain("table-fixed");
    expect(html).toContain("whitespace-normal");
    expect(html).toMatch(/<div class="px-4 pb-6 sm:px-8">/);
  });

  it("layout / nowrap / flush 分别切换列宽算法、不换行与容器内边距；cellClassName 追加到该列单元格", () => {
    const html = render({ layout: "auto", nowrap: true, flush: true });
    expect(html).toContain("table-auto");
    expect(html).not.toContain("table-fixed");
    expect(html).not.toContain("whitespace-normal");
    expect((html.match(/<td[^>]*whitespace-nowrap/g) ?? []).length).toBe(columns.length);
    expect(html).not.toContain("px-4 pb-6");
    expect(html).toMatch(/<td[^>]*class="[^"]*truncate[^"]*">1<\/td>/);
  });

  it("空列表只渲染提示，flush 时去掉左右内边距", () => {
    expect(render({ rows: [] })).toMatch(/^<p class="[^"]*px-4 sm:px-8"/);
    expect(render({ rows: [], flush: true })).not.toContain("px-4");
  });
});
