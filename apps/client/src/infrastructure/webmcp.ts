import { useEffect, useRef } from "react";

export interface WebMcpTextResult {
  readonly content: readonly [{ readonly text: string; readonly type: "text" }];
  readonly structuredContent?: unknown;
}

export function webMcpResult(text: string, structuredContent?: unknown): WebMcpTextResult {
  if (structuredContent === undefined) {
    return { content: [{ text, type: "text" }] };
  }
  return { content: [{ text, type: "text" }], structuredContent };
}

export function useWebMcpTools(tools: readonly WebMCP.ModelContextTool[]): void {
  const latestTools = useRef(tools);
  latestTools.current = tools;
  const toolNames = tools.map(({ name }) => name).join("|");

  useEffect(() => {
    if (typeof document === "undefined" || document.modelContext === undefined) {
      return undefined;
    }

    const controller = new AbortController();
    for (const tool of latestTools.current) {
      const registeredTool = {
        ...tool,
        execute: (input: Record<string, unknown>) => {
          const currentTool = latestTools.current.find(({ name }) => name === tool.name);
          if (currentTool === undefined) {
            throw new Error(`WebMCP tool ${tool.name} is no longer available.`);
          }
          return currentTool.execute(input);
        },
      } satisfies WebMCP.ModelContextTool;
      void document.modelContext
        .registerTool(registeredTool, { signal: controller.signal })
        .catch(() => {
          // WebMCP is progressive enhancement. A denied browser permission must not impair the UI.
        });
    }
    return () => controller.abort();
  }, [toolNames]);
}

export function integerInput(
  input: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number {
  const value = input[key];
  if (!Number.isInteger(value) || typeof value !== "number" || value < minimum || value > maximum) {
    throw new RangeError(`${key} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

export function stringArrayInput(
  input: Record<string, unknown>,
  key: string,
  expectedLength: number,
): readonly string[] {
  const value = input[key];
  if (
    !Array.isArray(value) ||
    value.length !== expectedLength ||
    !value.every((item) => typeof item === "string" && item.trim().length > 0)
  ) {
    throw new Error(`${key} must contain ${expectedLength} non-empty strings.`);
  }
  return value;
}

export function integerArrayInput(
  input: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): readonly number[] {
  const value = input[key];
  if (
    !Array.isArray(value) ||
    !value.every(
      (item) =>
        Number.isInteger(item) && typeof item === "number" && item >= minimum && item <= maximum,
    )
  ) {
    throw new RangeError(`${key} must contain only integers from ${minimum} to ${maximum}.`);
  }
  return [...new Set(value)];
}
