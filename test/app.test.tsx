import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/preact";
import { App } from "../src/app";
import { sampleText } from "../src/game/adapter";
import { storageKey } from "../src/common/state";
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("starts with synthetic guide, separate awards, and no network request", () => {
  render(<App />);
  expect(screen.getByText(/synthetic demo/i)).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Achievement awards" }),
  ).toBeTruthy();
  expect(screen.getByText(/unconnected/i)).toBeTruthy();
  expect(
    screen.getByLabelText("Save URL").getAttribute("value") ??
      (screen.getByLabelText("Save URL") as HTMLInputElement).value,
  ).toBe("");
  expect(
    screen.getByRole("button", { name: "Read save" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});
it("persists manual checklist marks across remounts", () => {
  const view = render(<App />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Read the route notes" }),
  );
  view.unmount();
  render(<App />);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Read the route notes",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});
it("uploads synthetic bytes and displays only parsed facts", async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Upload save"), {
    target: { files: [new File([sampleText], "synthetic.json")] },
  });
  await screen.findByText("Chapter");
  expect(screen.getByText("2")).toBeTruthy();
  expect(screen.getByText(/manual upload parsed/i)).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
it("requires source opt-in and manual upload disables remote reads", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(sampleText)),
  );
  render(<App />);
  fireEvent.input(screen.getByLabelText("Save URL"), {
    target: { value: "/save" },
  });
  expect(
    screen.getByRole("button", { name: "Read save" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(screen.getByLabelText("Enable remote reads"));
  fireEvent.click(screen.getByRole("button", { name: "Read save" }));
  await screen.findByText(/remote save parsed/i);
  fireEvent.change(screen.getByLabelText("Upload save"), {
    target: { files: [new File([sampleText], "synthetic.json")] },
  });
  await screen.findByText(/manual upload parsed/i);
  expect(
    (screen.getByLabelText("Enable remote reads") as HTMLInputElement).checked,
  ).toBe(false);
});
it("new attempt clears facts and marks; undo restores them", async () => {
  render(<App />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Read the route notes" }),
  );
  fireEvent.change(screen.getByLabelText("Upload save"), {
    target: { files: [new File([sampleText], "synthetic.json")] },
  });
  await screen.findByText("Chapter");
  fireEvent.click(screen.getByRole("button", { name: "New attempt" }));
  expect(screen.queryByText("Chapter")).toBeNull();
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Read the route notes",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Undo new attempt" }));
  expect(screen.getByText("Chapter")).toBeTruthy();
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Read the route notes",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});
it("restores valid progress and rejects invalid restore without changing marks", async () => {
  const view = render(<App />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Read the route notes" }),
  );
  const raw = localStorage.getItem(storageKey("demo-quest"))!;
  fireEvent.click(screen.getByRole("button", { name: "New attempt" }));
  fireEvent.change(screen.getByLabelText("Restore progress"), {
    target: { files: [new File([raw], "progress.json")] },
  });
  await screen.findByText(/progress restored/i);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Read the route notes",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Restore progress"), {
    target: { files: [new File(["{}"], "bad.json")] },
  });
  await screen.findByText(/invalid, foreign-game/i);
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Read the route notes",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  view.unmount();
});
it("exposes recovery without overwriting unknown storage", () => {
  localStorage.setItem(storageKey("demo-quest"), "future original");
  render(<App />);
  expect(
    screen.getByRole("button", { name: "Download recovery" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Read the route notes" }),
  );
  expect(localStorage.getItem(storageKey("demo-quest"))).toBe(
    "future original",
  );
});
it("a late remote body cannot populate a new attempt", async () => {
  let release!: (v: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    ),
  );
  render(<App />);
  fireEvent.input(screen.getByLabelText("Save URL"), {
    target: { value: "/save" },
  });
  fireEvent.click(screen.getByLabelText("Enable remote reads"));
  fireEvent.click(screen.getByRole("button", { name: "Read save" }));
  fireEvent.click(screen.getByRole("button", { name: "New attempt" }));
  release(new Response(sampleText));
  await waitFor(() =>
    expect(screen.getByText(/new attempt started/i)).toBeTruthy(),
  );
  expect(screen.queryByText("Chapter")).toBeNull();
});
