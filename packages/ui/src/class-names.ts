/**
 * Join the class names that apply, skipping the ones whose condition did not
 * hold. Conditions are written inline at the call site — `selected && s.selected`
 * — which reads the same way the old style arrays did.
 */
export function classNames(...values: readonly (string | false | null | undefined)[]): string {
  return values
    .filter((value): value is string => typeof value === "string" && value !== "")
    .join(" ");
}
