import { ManualEntryScreen } from "../src/screens/manual-entry-screen";
import { parseRecognitionDraft } from "../src/features/recognition/recognition-draft";
import { useLocalSearchParams } from "../src/navigation/router";

export default function ManualRoute() {
  const parameters = useLocalSearchParams();
  const recognitionDraft = parseRecognitionDraft({
    dora: parameters["recognizedDora"],
    melds: parameters["recognizedMelds"],
    modelVersion: parameters["recognizedModel"],
    reviewedCount: parameters["recognizedReviewedCount"],
    tiles: parameters["recognizedTiles"],
    winningIndex: parameters["recognizedWinningIndex"],
  });
  return (
    <ManualEntryScreen
      recognitionDraft={recognitionDraft}
      referencePhoto={parameters["referencePhoto"]}
    />
  );
}
