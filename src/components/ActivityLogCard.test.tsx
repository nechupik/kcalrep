import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { ActivityLogCard } from "./ActivityLogCard";
import { deleteActivityLog, loadActivityLogRange, saveActivityLog } from "@/lib/firestore";

// Mock at the firestore.ts boundary, as the rest of the project does.
vi.mock("@/lib/firestore", () => ({
  loadActivityLogRange: vi.fn(),
  saveActivityLog: vi.fn(),
  deleteActivityLog: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const load = vi.mocked(loadActivityLogRange);
const save = vi.mocked(saveActivityLog);
const remove = vi.mocked(deleteActivityLog);

const stamp = {} as never; // updatedAt is irrelevant to the card

/** Only Date is faked, so timers and promises keep working under Testing Library's waitFor. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 19, 12, 0, 0)); // Sat 19 Sep 2026, local time
  load.mockResolvedValue([]);
  save.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const nbsp = (s: string | null | undefined) => (s ?? "").replace(/\s/g, " ");
const ownText = (expected: string) => (content: string) => nbsp(content) === expected;

const kcalInput = () => screen.getByLabelText("Активность (ккал)") as HTMLInputElement;
const stepsInput = () => screen.getByLabelText("Шаги") as HTMLInputElement;
const dateInput = () => screen.getByLabelText("Дата") as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: "Сохранить" }) as HTMLButtonElement;

const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, { target: { value } });

/** Renders and waits for the card's first load to land, so no state update happens after the test. */
const renderCard = () =>
  act(async () => {
    render(<ActivityLogCard userId="u1" />);
  });

describe("ActivityLogCard", () => {
  it("says up front that the entries stay out of the КБЖУ calculation", async () => {
    await renderCard();
    expect(screen.getByText(/В расчёт КБЖУ и нормы не входят/)).toBeInTheDocument();
  });

  it("loads the last 7 days, today first, and shows what was saved", async () => {
    load.mockResolvedValue([
      { date: "2026-09-19", calories: 450, steps: 8200, updatedAt: stamp },
      { date: "2026-09-18", steps: 6100, updatedAt: stamp },
    ]);
    await renderCard();

    expect(load).toHaveBeenCalledWith("u1", "2026-09-13", "2026-09-19");
    expect(await screen.findByText(ownText("450 ккал"))).toBeInTheDocument();
    expect(screen.getByText(ownText("8 200 шагов"))).toBeInTheDocument();
    expect(screen.getByText(ownText("6 100 шагов"))).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent("Сегодня");
    expect(rows[1]).toHaveTextContent("Вчера");
  });

  it("saves kcal and steps for today, clears the form and shows the new values", async () => {
    await renderCard();
    type(kcalInput(), "450");
    type(stepsInput(), "8200");
    fireEvent.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith("u1", { date: "2026-09-19", calories: 450, steps: 8200 });
    expect(toast.success).toHaveBeenCalled();
    await waitFor(() => expect(kcalInput().value).toBe(""));
    expect(stepsInput().value).toBe("");
    expect(screen.getByText(ownText("450 ккал"))).toBeInTheDocument();
    expect(screen.getByText(ownText("8 200 шагов"))).toBeInTheDocument();
  });

  it("lets you enter just one of the two; the other is left out so the stored value is kept", async () => {
    await renderCard();
    type(stepsInput(), "6000");
    fireEvent.click(saveButton());

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const payload = save.mock.calls[0][1];
    expect(payload).toMatchObject({ date: "2026-09-19", steps: 6000 });
    expect(payload.calories).toBeUndefined();
  });

  it("keeps the other value shown when only one is updated", async () => {
    load.mockResolvedValue([{ date: "2026-09-19", calories: 450, steps: 8200, updatedAt: stamp }]);
    await renderCard();
    await screen.findByText(ownText("450 ккал"));

    type(stepsInput(), "9000");
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByText(ownText("9 000 шагов"))).toBeInTheDocument());
    expect(screen.getByText(ownText("450 ккал"))).toBeInTheDocument();
  });

  it("does not offer to save an empty form", async () => {
    await renderCard();
    expect(saveButton()).toBeDisabled();
    type(kcalInput(), "300");
    expect(saveButton()).toBeEnabled();
  });

  it("rejects an impossible number without saving", async () => {
    await renderCard();
    type(kcalInput(), "-5");
    fireEvent.click(saveButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects a date in the future", async () => {
    await renderCard();
    type(dateInput(), "2026-09-25");
    type(kcalInput(), "300");
    fireEvent.click(saveButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(save).not.toHaveBeenCalled();
  });

  it("tapping a day fills the form's date, so an earlier day can be filled in", async () => {
    await renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Внести данные за Вчера" }));
    expect(dateInput().value).toBe("2026-09-18");

    type(kcalInput(), "520");
    fireEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledWith("u1", { date: "2026-09-18", calories: 520, steps: undefined }));
  });

  it("deletes a day's entry", async () => {
    load.mockResolvedValue([{ date: "2026-09-18", calories: 300, steps: 5000, updatedAt: stamp }]);
    await renderCard();
    await screen.findByText(ownText("300 ккал"));

    fireEvent.click(screen.getByRole("button", { name: "Удалить запись за Вчера" }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("u1", "2026-09-18"));
    await waitFor(() => expect(screen.queryByText(ownText("300 ккал"))).not.toBeInTheDocument());
    // Days without data have nothing to delete.
    expect(screen.queryByRole("button", { name: /Удалить запись/ })).not.toBeInTheDocument();
  });

  it("reports a failed save instead of pretending it worked", async () => {
    save.mockRejectedValue(new Error("permission-denied"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderCard();
    type(kcalInput(), "450");
    fireEvent.click(saveButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ошибка сохранения активности"));
    expect(toast.success).not.toHaveBeenCalled();
    expect(kcalInput().value).toBe("450"); // what was typed is not lost
    errorLog.mockRestore();
  });

  it("shows a message when the log cannot be loaded", async () => {
    load.mockRejectedValue(new Error("permission-denied"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await renderCard();

    expect(await screen.findByText("Не удалось загрузить записи.")).toBeInTheDocument();
    errorLog.mockRestore();
  });
});
