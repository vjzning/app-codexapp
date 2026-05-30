export type ComposerMention =
  | {
      type: "skill";
      name: string;
      path: string;
    }
  | {
      type: "app";
      id: string;
      name: string;
    };
