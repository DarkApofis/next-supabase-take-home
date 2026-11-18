import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { change, mount } from "@/components/test-utils";
import type { Range } from "@/domain/coffee-records/query";
import { RangeFilter } from "./range-filter";

// Only timeouts are faked so React's own scheduling keeps running normally.
const fakeTimeouts = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

describe("RangeFilter", () => {
  afterEach(() => vi.useRealTimers());

  const ui = (value: Range, onChange: (r: Range) => void) => (
    <RangeFilter id="age" label="Age" step={1} value={value} onChange={onChange} />
  );

  it("debounces typing into a single change", () => {
    const onChange = vi.fn();
    const { container } = mount(ui({}, onChange));
    fakeTimeouts();
    const min = container.querySelector<HTMLInputElement>("#age-min")!;
    change(min, "1");
    change(min, "15");
    act(() => vi.advanceTimersByTime(400));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ min: 15, max: undefined });
  });

  it("keeps what the user is typing when an earlier value echoes back from the URL", () => {
    const onChange = vi.fn();
    const { container, rerender } = mount(ui({}, onChange));
    fakeTimeouts();
    const min = container.querySelector<HTMLInputElement>("#age-min")!;
    change(min, "1");
    act(() => vi.advanceTimersByTime(400)); // sends min=1
    change(min, "15"); // still debouncing
    rerender(ui({ min: 1 }, onChange)); // server answers for min=1
    expect(min.value).toBe("15");
  });

  it("follows external URL changes such as a removed chip", () => {
    const { container, rerender } = mount(ui({ min: 20 }, vi.fn()));
    rerender(ui({}, vi.fn()));
    expect(container.querySelector<HTMLInputElement>("#age-min")!.value).toBe("");
  });
});

describe("RangeFilter callback freshness", () => {
  afterEach(() => vi.useRealTimers());

  it("calls the onChange from the latest render, not the one captured at the keystroke", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender } = mount(
      <RangeFilter id="age" label="Age" step={1} value={{}} onChange={first} />,
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    change(container.querySelector<HTMLInputElement>("#age-min")!, "30");
    // e.g. the user re-sorted while the debounce was pending
    rerender(<RangeFilter id="age" label="Age" step={1} value={{}} onChange={second} />);
    act(() => vi.advanceTimersByTime(400));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ min: 30, max: undefined });
  });
});
