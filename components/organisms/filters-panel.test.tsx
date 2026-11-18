import { describe, expect, it, vi } from "vitest";
import { change, mount } from "@/components/test-utils";
import { parseListQuery } from "@/domain/coffee-records/query";
import { FiltersPanel } from "./filters-panel";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("FiltersPanel", () => {
  it("accumulates changes made before the server re-renders", () => {
    const { container } = mount(<FiltersPanel query={parseListQuery({ page: "4" })} />);
    change(container.querySelector<HTMLSelectElement>("#filter-smoking")!, "true");
    change(container.querySelector<HTMLSelectElement>("#filter-alcohol_consumption")!, "false");

    const last = new URL(push.mock.lastCall![0], "http://x").searchParams;
    expect(last.get("smoking")).toBe("true");
    expect(last.get("alcohol_consumption")).toBe("false");
    expect(last.get("page")).toBeNull(); // filter change resets paging
  });
});
