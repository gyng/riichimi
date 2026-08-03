import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import * as announcerStorage from "../src/infrastructure/announcer-preference-storage";
import { AnnounceBesideScore } from "../src/features/announcer/announce-beside-score";
import { AnnounceControl } from "../src/features/announcer/announce-control";
import { AnnouncerProvider } from "../src/state/announcer-context";
import { LocaleProvider } from "../src/state/locale-context";

// Hand-written fakes rather than configured mocks: each is a whole SpeechPort,
// and the tests assert which one was asked to speak.
const { browser, neural, watchers } = vi.hoisted(() => ({
  browser: {
    available: true,
    cancel: vi.fn<() => void>(),
    speak: vi.fn<(text: string) => void>(),
  },
  neural: {
    available: true,
    cancel: vi.fn<() => void>(),
    speak: vi.fn<(text: string) => void>(),
  },
  watchers: new Set<(state: { kind: string }) => void>(),
}));

vi.mock("../src/infrastructure/speech", () => ({ speech: browser }));

vi.mock("../src/infrastructure/kokoro-speech", () => ({
  kokoroSpeech: neural,
  neuralVoiceState: () => ({ kind: "idle" }),
  // Choosing the neural voice now starts the fetch, so the context reaches for
  // these too; without them it calls undefined and the choice never lands.
  prepareNeuralVoice: vi.fn<() => Promise<null>>().mockResolvedValue(null),
  setNeuralPace: vi.fn<(pace: number) => void>(),
  setNeuralSpeaker: vi.fn<(speaker: string) => void>(),
  watchNeuralVoice: (listener: (state: { kind: string }) => void) => {
    watchers.add(listener);
    return () => watchers.delete(listener);
  },
}));

vi.mock("../src/infrastructure/announcer-preference-storage", () => ({
  loadAnnouncerPreference: vi
    .fn<typeof announcerStorage.loadAnnouncerPreference>()
    .mockResolvedValue(true),
  loadAnnouncerVoice: vi
    .fn<typeof announcerStorage.loadAnnouncerVoice>()
    .mockResolvedValue("system"),
  loadCelebratePreference: vi
    .fn<typeof announcerStorage.loadCelebratePreference>()
    .mockResolvedValue(true),
  saveAnnouncerPreference: vi
    .fn<typeof announcerStorage.saveAnnouncerPreference>()
    .mockResolvedValue(undefined),
  saveAnnouncerVoice: vi
    .fn<typeof announcerStorage.saveAnnouncerVoice>()
    .mockResolvedValue(undefined),
  saveCelebratePreference: vi
    .fn<typeof announcerStorage.saveCelebratePreference>()
    .mockResolvedValue(undefined),
  loadNeuralSpeaker: vi
    .fn<typeof announcerStorage.loadNeuralSpeaker>()
    .mockResolvedValue("jf_alpha"),
  saveNeuralSpeaker: vi
    .fn<typeof announcerStorage.saveNeuralSpeaker>()
    .mockResolvedValue(undefined),
  loadDelivery: vi.fn<typeof announcerStorage.loadDelivery>().mockResolvedValue("parlour"),
  saveDelivery: vi.fn<typeof announcerStorage.saveDelivery>().mockResolvedValue(undefined),
}));

function renderControl() {
  return render(
    <LocaleProvider>
      <AnnouncerProvider>
        <AnnounceControl />
      </AnnouncerProvider>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  watchers.clear();
  // These resolve values live on the shared module mock, so a test that changes
  // one has to hand it back or the next test inherits it.
  vi.mocked(announcerStorage.loadAnnouncerPreference).mockResolvedValue(true);
  vi.mocked(announcerStorage.loadAnnouncerVoice).mockResolvedValue("system");
});

describe("choosing the announcer's voice", () => {
  it("offers the choice only once a win is being announced out loud", async () => {
    vi.mocked(announcerStorage.loadAnnouncerPreference).mockResolvedValue(false);
    renderControl();

    // Nothing to choose between while nothing is being read aloud.
    expect(screen.queryByRole("radiogroup", { name: "VOICE" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Announce a win out loud" }));

    expect(await screen.findByRole("radiogroup", { name: "VOICE" })).toBeInTheDocument();
  });

  it("starts on the voice the device already has, and says nothing needs fetching", async () => {
    renderControl();

    const device = await screen.findByRole("radio", { name: "This device" });
    expect(device).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("Whatever voice this device already has. Nothing to fetch."),
    ).toBeInTheDocument();
  });

  it("names the download before it happens, rather than after", async () => {
    renderControl();

    fireEvent.click(await screen.findByRole("radio", { name: "Neural" }));

    // The size is the whole decision, so it has to be readable before choosing
    // and stay readable after.
    expect(screen.getByText(/90 MB/)).toBeInTheDocument();
  });

  it("remembers the choice", async () => {
    renderControl();

    fireEvent.click(await screen.findByRole("radio", { name: "Neural" }));

    await waitFor(() => {
      expect(announcerStorage.saveAnnouncerVoice).toHaveBeenCalledWith("neural");
    });
  });

  it("restores a stored choice", async () => {
    vi.mocked(announcerStorage.loadAnnouncerVoice).mockResolvedValue("neural");
    renderControl();

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "Neural" })).toHaveAttribute("aria-checked", "true");
    });
  });

  it("stops the voice that was talking before handing over to the other", async () => {
    renderControl();

    fireEvent.click(await screen.findByRole("radio", { name: "Neural" }));

    // Switching mid-sentence should not leave two engines overlapping.
    expect(browser.cancel).toHaveBeenCalled();
  });

  it("says so when the voice could not be fetched, because the browser quietly takes over", async () => {
    vi.mocked(announcerStorage.loadAnnouncerVoice).mockResolvedValue("neural");
    renderControl();
    await screen.findByRole("radio", { name: "Neural" });

    for (const listener of watchers) {
      listener({ kind: "failed" });
    }

    expect(
      await screen.findByText(
        "The voice could not be fetched. This device's own voice will read wins instead.",
      ),
    ).toBeInTheDocument();
  });
});

describe("the announcer beside the score", () => {
  it("speaks the hand on screen the moment it is switched on", async () => {
    // The reason this control moved out of Setup: a player can hear whether
    // their device makes any sound at all without scoring a second hand.
    vi.mocked(announcerStorage.loadAnnouncerPreference).mockResolvedValue(false);
    const sayAgain = vi.fn<() => void>();
    render(
      <LocaleProvider>
        <AnnouncerProvider>
          <AnnounceBesideScore onSayAgain={sayAgain} />
        </AnnouncerProvider>
      </LocaleProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Announce wins/ }));

    expect(sayAgain).toHaveBeenCalledTimes(1);
  });

  it("replays the score on request", async () => {
    const sayAgain = vi.fn<() => void>();
    render(
      <LocaleProvider>
        <AnnouncerProvider>
          <AnnounceBesideScore onSayAgain={sayAgain} />
        </AnnouncerProvider>
      </LocaleProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Say it again" }));

    expect(sayAgain).toHaveBeenCalledTimes(1);
  });

  it("stops mid-sentence when switched off, rather than finishing", async () => {
    const sayAgain = vi.fn<() => void>();
    render(
      <LocaleProvider>
        <AnnouncerProvider>
          <AnnounceBesideScore onSayAgain={sayAgain} />
        </AnnouncerProvider>
      </LocaleProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Announcing wins/ }));

    expect(browser.cancel).toHaveBeenCalled();
    expect(sayAgain).not.toHaveBeenCalled();
  });

  it("says nothing at all where the device has no voice", async () => {
    browser.available = false;
    const { container } = render(
      <LocaleProvider>
        <AnnouncerProvider>
          <AnnounceBesideScore onSayAgain={vi.fn<() => void>()} />
        </AnnouncerProvider>
      </LocaleProvider>,
    );

    expect(container).toBeEmptyDOMElement();
    browser.available = true;
  });
});
