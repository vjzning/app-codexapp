export type CommandOutputSummary = {
  kind: "test-failure" | "test-success" | "generic-error" | "generic";
  title: string;
  lines: string[];
};

const FAILURE_PATTERNS = [
  /\bfailed\b/i,
  /\bfailures?\b/i,
  /\berror\b/i,
  /\bERR_PNPM\b/i,
  /\bexit status [1-9]\b/i,
  /\bexit code [1-9]\b/i,
];

const TEST_PATTERNS = [/\btest\b/i, /\bpytest\b/i, /\bjest\b/i, /\bvitest\b/i, /\btsc\b/i, /\btypecheck\b/i, /\bpassed\b/i];

export function summarizeCommandOutput(output: string, exitCode: number | null | undefined): CommandOutputSummary {
  const trimmed = output.trim();

  if (!trimmed) {
    return {
      kind: exitCode && exitCode !== 0 ? "generic-error" : "generic",
      title: exitCode && exitCode !== 0 ? `命令退出码 ${exitCode}` : "无输出",
      lines: [],
    };
  }

  const interestingLines = pickInterestingLines(trimmed);
  const isFailure = Boolean(exitCode && exitCode !== 0) || FAILURE_PATTERNS.some((pattern) => pattern.test(trimmed));
  const looksLikeTest = TEST_PATTERNS.some((pattern) => pattern.test(trimmed));

  if (isFailure && looksLikeTest) {
    return {
      kind: "test-failure",
      title: exitCode && exitCode !== 0 ? `测试失败，退出码 ${exitCode}` : "测试失败",
      lines: interestingLines,
    };
  }

  if (!isFailure && looksLikeTest) {
    return {
      kind: "test-success",
      title: "测试通过",
      lines: interestingLines,
    };
  }

  if (isFailure) {
    return {
      kind: "generic-error",
      title: exitCode && exitCode !== 0 ? `命令失败，退出码 ${exitCode}` : "命令失败",
      lines: interestingLines,
    };
  }

  return {
    kind: "generic",
    title: "命令输出",
    lines: interestingLines,
  };
}

function pickInterestingLines(output: string) {
  const lines = output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  const matched = lines.filter((line) => FAILURE_PATTERNS.some((pattern) => pattern.test(line)) || /(^\s*[✕×✗]|^\s*FAIL|^\s*Error:|^\s*at\s+)/i.test(line));

  if (matched.length > 0) {
    return matched.slice(0, 6);
  }

  if (lines.length <= 6) {
    return lines;
  }

  return [...lines.slice(0, 3), "...", ...lines.slice(-2)];
}
