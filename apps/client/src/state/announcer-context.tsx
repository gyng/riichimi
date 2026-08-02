import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type {
  AnnouncerVoice,
  DeliveryId,
  NeuralSpeaker,
} from "../features/announcer/announcer-preference";
import { deliveryFor } from "../features/announcer/announcer-preference";
import type { SpeechPort } from "../features/announcer/speech-port";
import {
  loadAnnouncerPreference,
  loadAnnouncerVoice,
  loadCelebratePreference,
  loadDelivery,
  loadNeuralSpeaker,
  saveAnnouncerPreference,
  saveAnnouncerVoice,
  saveCelebratePreference,
  saveDelivery,
  saveNeuralSpeaker,
} from "../infrastructure/announcer-preference-storage";
import { setNeuralPace, setNeuralSpeaker } from "../infrastructure/kokoro-speech";
import { setSpeechPace } from "../infrastructure/speech";
import { speechFor } from "../infrastructure/speech-selection";

interface AnnouncerPreference {
  readonly announceWins: boolean;
  readonly setAnnounceWins: (enabled: boolean) => void;
  readonly celebrateWins: boolean;
  readonly setCelebrateWins: (enabled: boolean) => void;
  readonly voice: AnnouncerVoice;
  readonly setVoice: (voice: AnnouncerVoice) => void;
  readonly speaker: NeuralSpeaker;
  readonly setSpeaker: (speaker: NeuralSpeaker) => void;
  readonly delivery: DeliveryId;
  readonly setDelivery: (delivery: DeliveryId) => void;
  /** The pace and pauses the current delivery asks for. */
  readonly pace: number;
  readonly pauseMs: number;
  /** The engine the current choice resolves to. Callers speak through this. */
  readonly speech: SpeechPort;
}

const AnnouncerContext = createContext<AnnouncerPreference>({
  announceWins: false,
  setAnnounceWins: () => {},
  celebrateWins: true,
  setCelebrateWins: () => {},
  voice: "system",
  setVoice: () => {},
  speaker: "jf_alpha",
  setSpeaker: () => {},
  delivery: "parlour",
  setDelivery: () => {},
  pace: deliveryFor("parlour").pace,
  pauseMs: deliveryFor("parlour").pauseMs,
  speech: speechFor("system"),
});

/**
 * Two per-device win-feedback preferences, shared so Setup can toggle them and
 * the calculator can read them. Announcing audio that starts on its own is a
 * surprise, so it defaults off; the visual celebration is expected and defaults
 * on. Both are saved immediately on change.
 */
export function AnnouncerProvider({ children }: { readonly children: ReactNode }) {
  const announceChanged = useRef(false);
  const celebrateChanged = useRef(false);
  const voiceChanged = useRef(false);
  const [announceWins, setAnnounce] = useState(false);
  const [celebrateWins, setCelebrate] = useState(true);
  const [voice, setVoiceState] = useState<AnnouncerVoice>("system");
  const speakerChanged = useRef(false);
  const deliveryChanged = useRef(false);
  const [speaker, setSpeakerState] = useState<NeuralSpeaker>("jf_alpha");
  const [delivery, setDeliveryState] = useState<DeliveryId>("parlour");

  useEffect(() => {
    let active = true;
    void loadAnnouncerPreference()
      .then((stored) => {
        if (active && !announceChanged.current) {
          setAnnounce(stored);
        }
      })
      .catch(() => {
        // A device that cannot read the preference simply stays silent.
      });
    void loadCelebratePreference()
      .then((stored) => {
        if (active && !celebrateChanged.current) {
          setCelebrate(stored);
        }
      })
      .catch(() => {
        // A device that cannot read the preference keeps the default.
      });
    void loadAnnouncerVoice()
      .then((stored) => {
        if (active && !voiceChanged.current) {
          setVoiceState(stored);
        }
      })
      .catch(() => {
        // A device that cannot read the preference keeps the browser voice.
      });
    void loadNeuralSpeaker()
      .then((stored) => {
        if (active && !speakerChanged.current) {
          setSpeakerState(stored);
          setNeuralSpeaker(stored);
        }
      })
      .catch(() => {
        // A device that cannot read the preference keeps the default speaker.
      });
    void loadDelivery()
      .then((stored) => {
        if (active && !deliveryChanged.current) {
          setDeliveryState(stored);
          setNeuralPace(deliveryFor(stored).pace);
          setSpeechPace(deliveryFor(stored).pace);
        }
      })
      .catch(() => {
        // A device that cannot read the preference keeps the parlour delivery.
      });
    return () => {
      active = false;
    };
  }, []);

  function setAnnounceWins(next: boolean) {
    announceChanged.current = true;
    setAnnounce(next);
    void saveAnnouncerPreference(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  function setCelebrateWins(next: boolean) {
    celebrateChanged.current = true;
    setCelebrate(next);
    void saveCelebratePreference(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  function setVoice(next: AnnouncerVoice) {
    voiceChanged.current = true;
    // Whichever engine was talking should stop before the other starts.
    speechFor(voice).cancel();
    setVoiceState(next);
    void saveAnnouncerVoice(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  function setSpeaker(next: NeuralSpeaker) {
    speakerChanged.current = true;
    // Stop mid-sentence rather than finishing in the voice being replaced.
    speechFor(voice).cancel();
    setSpeakerState(next);
    setNeuralSpeaker(next);
    void saveNeuralSpeaker(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  function setDelivery(next: DeliveryId) {
    deliveryChanged.current = true;
    setDeliveryState(next);
    setNeuralPace(deliveryFor(next).pace);
    setSpeechPace(deliveryFor(next).pace);
    void saveDelivery(next).catch(() => {
      // Losing the preference is not worth interrupting scoring.
    });
  }

  return (
    <AnnouncerContext.Provider
      value={{
        announceWins,
        celebrateWins,
        delivery,
        pace: deliveryFor(delivery).pace,
        pauseMs: deliveryFor(delivery).pauseMs,
        setAnnounceWins,
        setCelebrateWins,
        setDelivery,
        setSpeaker,
        setVoice,
        speaker,
        speech: speechFor(voice),
        voice,
      }}
    >
      {children}
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerPreference {
  return useContext(AnnouncerContext);
}
