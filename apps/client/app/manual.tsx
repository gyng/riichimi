import { ManualEntryScreen } from "../src/screens/manual-entry-screen";
import { parseRecognitionDraft } from "../src/features/recognition/recognition-draft";
import { useLocalSearchParams } from "expo-router";

export default function ManualRoute() {
  const parameters = useLocalSearchParams<{
    recognizedDora?: string;
    recognizedMelds?: string;
    recognizedModel?: string;
    recognizedReviewedCount?: string;
    recognizedTiles?: string;
    recognizedWinningIndex?: string;
    referencePhoto?: string;
  }>();
  const recognitionDraft = parseRecognitionDraft({
    dora: parameters.recognizedDora,
    melds: parameters.recognizedMelds,
    modelVersion: parameters.recognizedModel,
    reviewedCount: parameters.recognizedReviewedCount,
    tiles: parameters.recognizedTiles,
    winningIndex: parameters.recognizedWinningIndex,
  });
  return (
    <ManualEntryScreen
      recognitionDraft={recognitionDraft}
      referencePhoto={parameters.referencePhoto}
    />
  );
}
