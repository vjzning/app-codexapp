import type { UserInput } from "@codex-mobile/protocol/v2";

import type { ComposerImageAttachment, ComposerMention } from "@/types/composer";

export function buildTurnInput(text: string, mentions: ComposerMention[] = [], imagePaths: string[] = []): UserInput[] {
  const input: UserInput[] = [];
  const trimmedText = text.trim();

  if (trimmedText) {
    input.push({
      type: "text",
      text: trimmedText,
      text_elements: [],
    });
  }

  for (const imagePath of imagePaths) {
    input.push({
      type: "localImage",
      path: imagePath,
    });
  }

  for (const mention of mentions) {
    input.push({
      // app-server 对 skill 有专门输入项；插件本身只负责提供 skill/app/MCP 能力，不作为直接输入项发送。
      type: "skill",
      name: mention.name,
      path: mention.path,
    });
  }

  return input;
}

export function buildPendingMessageBody(text: string, images: ComposerImageAttachment[]) {
  const trimmedText = text.trim();
  const imageText = images.length ? images.map((image) => `[图片] ${image.name}`).join("\n") : "";

  return [trimmedText, imageText].filter(Boolean).join("\n");
}
