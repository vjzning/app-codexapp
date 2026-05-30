export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function compactRpcError(error: unknown) {
  const rawMessage = getErrorMessage(error);
  const singleLine = rawMessage.replace(/\s+/g, " ").trim();
  const statusMatch = singleLine.match(/status\s+(\d+)\s+([^:<]+)/i) ?? singleLine.match(/HTTP\s+(\d+)\s+([^:<]+)/i);

  if (/<\/?[a-z][\s\S]*>/i.test(singleLine)) {
    if (statusMatch) {
      const status = statusMatch[1];
      const text = (statusMatch[2] ?? "").replace(/[:.].*$/, "").trim();
      return `HTTP ${status}${text ? ` ${text}` : ""}`;
    }

    return "服务返回了 HTML 错误页";
  }

  return singleLine.length > 220 ? `${singleLine.slice(0, 220)}...` : singleLine;
}
