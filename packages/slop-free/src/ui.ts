import { cancel, isCancel } from "@clack/prompts";
import process from "node:process";
import { inspect } from "node:util";

export const exitOnCancel = <T>(value: T | symbol): T => {
  if (isCancel(value)) {
    cancel("Cancelled.");
    process.exit(0);
  }

  return value;
};

const formatThrownValue = (value: unknown, depth = 0): string => {
  if (value instanceof Error) {
    const indent = "  ".repeat(depth + 1);
    const cause =
      value.cause === undefined
        ? ""
        : `\n${indent}caused by: ${formatThrownValue(value.cause, depth + 1)}`;
    return `${value.message}${cause}`;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return value.name.length > 0 ? `[Function: ${value.name}]` : "[Function]";
  }

  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  try {
    return JSON.stringify(value);
  } catch {
    try {
      return inspect(value, { depth: 3 });
    } catch {
      return "[unserializable value]";
    }
  }
};

export const formatError = (error: unknown): string => {
  return formatThrownValue(error);
};
