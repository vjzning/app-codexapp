export function normalizeImageUri(uri: string) {
  if (uri.startsWith("data:")) {
    return uri;
  }

  if (uri.startsWith("/") || uri.startsWith("file://")) {
    return uri.startsWith("file://") ? uri : `file://${uri}`;
  }

  return uri;
}

export function formatWorkspaceRelativePath(path: string, workspacePath: string) {
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedWorkspace = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");

  if (normalizedWorkspace && normalizedPath.startsWith(`${normalizedWorkspace}/`)) {
    return normalizedPath.slice(normalizedWorkspace.length + 1);
  }

  return normalizedPath;
}

export function formatMessageTime(timestampMs: number) {
  const date = new Date(timestampMs);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (isToday) {
    return time;
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
