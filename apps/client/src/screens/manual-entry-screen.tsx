import { ManualCalculator } from "../features/manual-calculator/manual-calculator";

export function ManualEntryScreen({
  referencePhoto,
}: {
  readonly referencePhoto?: string | undefined;
}) {
  return <ManualCalculator referencePhoto={referencePhoto} />;
}
