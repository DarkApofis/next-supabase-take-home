import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { change, mount } from "@/components/test-utils";
import { parseListQuery } from "@/domain/coffee-records/query";
import { FiltersPanel } from "./filters-panel";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const lastPushed = () => new URL(push.mock.lastCall![0], "http://x").searchParams;

describe("FiltersPanel", () => {
  afterEach(() => {
    vi.useRealTimers();
    push.mockClear();
  });

  it("accumulates changes made before the server re-renders", () => {
    const { container } = mount(<FiltersPanel query={parseListQuery({ page: "4" })} />);
    change(container.querySelector<HTMLSelectElement>("#filter-smoking")!, "true");
    change(container.querySelector<HTMLSelectElement>("#filter-alcohol_consumption")!, "false");

    const last = lastPushed();
    expect(last.get("smoking")).toBe("true");
    expect(last.get("alcohol_consumption")).toBe("false");
    expect(last.get("page")).toBeNull(); // filter change resets paging
  });

  it("keeps both ranges when two are typed within one debounce window", () => {
    const { container } = mount(<FiltersPanel query={parseListQuery({})} />);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    change(container.querySelector<HTMLInputElement>("#filter-age-min")!, "30");
    change(container.querySelector<HTMLInputElement>("#filter-coffee_intake-min")!, "2");
    act(() => vi.advanceTimersByTime(400));

    const last = lastPushed();
    expect(last.get("age_min")).toBe("30");
    expect(last.get("coffee_intake_min")).toBe("2");
  });
});
