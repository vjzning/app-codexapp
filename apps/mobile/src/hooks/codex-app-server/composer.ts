import type { UserInput } from "@codex-mobile/protocol/v2";

import type { ComposerMention } from "@/types/composer";

export function buildTurnInput(text: string, mentions: ComposerMention[] = []): UserInput[] {
  const input: UserInput[] = [
    {
      type: "text",
      text,
      text_elements: [],
    },
  ];

  for (const mention of mentions) {
    if (mention.type === "skill") {
      input.push({
        type: "skill",
        name: mention.name,
        path: mention.path,
      });
      continue;
    }

    input.push({
      type: "mention",
      name: mention.name,
      path: `app://${mention.id}`,
    });
  }

  return input;
}
