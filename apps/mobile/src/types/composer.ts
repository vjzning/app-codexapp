export type ComposerMention =
  {
    type: "skill";
    name: string;
    path: string;
  };

export type ComposerImageAttachment = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
};
