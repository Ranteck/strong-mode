import { cancel, isCancel } from "@clack/prompts";
import process from "node:process";
import { inspect } from "node:util";
import color from "picocolors";

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

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
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

export type UiTone = "danger" | "info" | "neutral" | "success" | "warning";

const supportsRichColor =
  color.isColorSupported &&
  ((typeof process.env.COLORTERM === "string" &&
    /(truecolor|24bit)/iu.test(process.env.COLORTERM)) ||
    (typeof process.env.TERM === "string" &&
      /(256color|direct)/iu.test(process.env.TERM)));

const applyAnsiColor = (
  value: string,
  open: string,
  fallback: (text: string) => string,
): string => (supportsRichColor ? `${open}${value}\x1b[39m` : fallback(value));

const palette = {
  accent: (value: string): string =>
    applyAnsiColor(value, "\x1b[38;2;245;184;90m", color.yellow),
  brand: (value: string): string =>
    applyAnsiColor(value, "\x1b[38;2;95;215;198m", color.cyan),
  danger: (value: string): string =>
    applyAnsiColor(value, "\x1b[38;2;255;122;107m", color.red),
  muted: (value: string): string =>
    applyAnsiColor(value, "\x1b[38;2;148;163;184m", color.gray),
  success: (value: string): string =>
    applyAnsiColor(value, "\x1b[38;2;115;217;159m", color.green),
  text: (value: string): string =>
    applyAnsiColor(value, "\x1b[38;2;230;238;243m", color.whiteBright),
  warning: (value: string): string =>
    applyAnsiColor(value, "\x1b[38;2;255;175;95m", color.yellowBright),
} as const;

const toneColor = (value: string, tone: UiTone): string => {
  if (tone === "success") {
    return palette.success(value);
  }

  if (tone === "warning") {
    return palette.warning(value);
  }

  if (tone === "danger") {
    return palette.danger(value);
  }

  if (tone === "info") {
    return palette.brand(value);
  }

  return palette.text(value);
};

export const formatIntroTitle = (): string =>
  `${color.bold(palette.brand("slop-free"))} ${palette.muted("anti-slop retrofit")}`;

export const formatSectionTitle = (title: string): string =>
  color.bold(palette.brand(title));

export const formatKeyValue = (
  label: string,
  value: string,
  tone: UiTone = "neutral",
): string => `  ${palette.muted(`${label}:`)} ${toneColor(value, tone)}`;

export const formatMuted = (value: string): string => palette.muted(value);

export const formatToneText = (value: string, tone: UiTone): string =>
  toneColor(value, tone);

export const formatPath = (value: string): string => palette.brand(value);

export const formatPackageManagerOption = (
  _packageManager: string,
  label: string,
): string => `${palette.text(label)} ${palette.muted("package manager")}`;

export const formatRecommendedAction = (value: string): string =>
  `${palette.accent(value)} ${palette.muted("(recommended)")}`;
