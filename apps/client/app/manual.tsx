import { ManualEntryScreen } from "../src/screens/manual-entry-screen";
import { useLocalSearchParams } from "expo-router";

export default function ManualRoute() {
  const { referencePhoto } = useLocalSearchParams<{ referencePhoto?: string }>();
  return <ManualEntryScreen referencePhoto={referencePhoto} />;
}
