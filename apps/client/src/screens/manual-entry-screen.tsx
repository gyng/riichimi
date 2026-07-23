import { ManualCalculator } from "../features/manual-calculator/manual-calculator";
import type { RecognitionDraft } from "../features/recognition/recognition-draft";

export function ManualEntryScreen({
  recognitionDraft,
  referencePhoto,
}: {
  readonly recognitionDraft?: RecognitionDraft | undefined;
  readonly referencePhoto?: string | undefined;
}) {
  return <ManualCalculator recognitionDraft={recognitionDraft} referencePhoto={referencePhoto} />;
}
