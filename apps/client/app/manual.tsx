import { ManualEntryScreen } from "../src/screens/manual-entry-screen";
import { parseRecognitionDraft } from "../src/features/recognition/recognition-draft";
import { useLocalSearchParams } from "expo-router";

export default function ManualRoute() {
  const parameters = useLocalSearchParams<{
    recognizedDora?: string;
    recognizedModel?: string;
    recognizedReviewCount?: string;
    recognizedTiles?: string;
    recognizedWinningIndex?: string;
    referencePhoto?: string;
  }>();
  const recognitionDraft = parseRecognitionDraft({
    dora: parameters.recognizedDora,
    modelVersion: parameters.recognizedModel,
    reviewCount: parameters.recognizedReviewCount,
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
