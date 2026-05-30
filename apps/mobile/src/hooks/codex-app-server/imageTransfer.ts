import * as FileSystem from "expo-file-system/legacy";

import type { FsReadFileResponse } from "@codex-mobile/protocol/v2";

import { JsonRpcClient } from "@/lib/jsonRpcClient";
import type { TimelineAttachment, TimelineEntry } from "@/lib/threadFormat";
import type { ComposerImageAttachment } from "@/types/composer";

const UPLOAD_DIR_NAME = ".codex-mobile/uploads";
export async function uploadComposerImages(client: JsonRpcClient, cwd: string, images: ComposerImageAttachment[]) {
  if (!images.length) {
    return [];
  }

  const uploadDir = joinHostPath(cwd, UPLOAD_DIR_NAME);
  await client.request("fs/createDirectory", {
    path: uploadDir,
    recursive: true,
  });

  const uploadedPaths: string[] = [];

  for (const image of images) {
    const dataBase64 = await FileSystem.readAsStringAsync(image.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const hostPath = joinHostPath(uploadDir, `${Date.now()}-${sanitizeFilename(image.name)}`);

    // 图片必须先写入 app-server 所在电脑的文件系统，否则 localImage 只能指向手机本地路径，电脑端读不到。
    await client.request("fs/writeFile", {
      path: hostPath,
      dataBase64,
    });
    uploadedPaths.push(hostPath);
  }

  return uploadedPaths;
}

export async function hydrateLocalImageAttachments(
  client: JsonRpcClient,
  timeline: TimelineEntry[],
  cache: Map<string, string>,
  onHydrated: () => void,
) {
  const localImageAttachments = collectLocalImageAttachments(timeline).filter((attachment) => !cache.has(attachment.uri));

  if (!localImageAttachments.length) {
    return;
  }

  const nextCache = new Map(cache);

  for (const attachment of localImageAttachments) {
    try {
      const response = await client.request<FsReadFileResponse>("fs/readFile", {
        path: attachment.uri,
      });
      nextCache.set(attachment.uri, `data:${guessMimeType(attachment.uri)};base64,${response.dataBase64}`);
    } catch {
      nextCache.set(attachment.uri, attachment.uri);
    }
  }

  cache.clear();
  for (const [key, value] of nextCache) {
    cache.set(key, value);
  }

  onHydrated();
}

export function applyLocalImageCache(timeline: TimelineEntry[], cache: Map<string, string>) {
  if (!cache.size) {
    return timeline;
  }

  return timeline.map((entry) => {
    if (!entry.attachments?.length) {
      return entry;
    }

    let changed = false;
    const attachments = entry.attachments.map((attachment) => {
      const hydratedUri = cache.get(attachment.uri);

      if (!hydratedUri || hydratedUri === attachment.uri) {
        return attachment;
      }

      changed = true;
      return {
        ...attachment,
        originalUri: attachment.originalUri ?? attachment.uri,
        uri: hydratedUri,
      };
    });

    return changed ? { ...entry, attachments } : entry;
  });
}

function collectLocalImageAttachments(timeline: TimelineEntry[]) {
  const attachments: TimelineAttachment[] = [];

  for (const entry of timeline) {
    for (const attachment of entry.attachments ?? []) {
      if (isHostLocalImage(attachment)) {
        attachments.push(attachment);
      }
    }
  }

  return attachments;
}

function isHostLocalImage(attachment: TimelineAttachment) {
  return attachment.uri.startsWith("/") && attachment.label === "本地图片";
}

function joinHostPath(basePath: string, childPath: string) {
  return `${basePath.replace(/\/+$/, "")}/${childPath.replace(/^\/+/, "")}`;
}

function sanitizeFilename(name: string) {
  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "image.jpg";
}

function guessMimeType(path: string) {
  const lower = path.toLowerCase();

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  if (lower.endsWith(".gif")) {
    return "image/gif";
  }

  return "image/jpeg";
}
