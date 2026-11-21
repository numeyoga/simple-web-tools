export type AllowedImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export interface RichTextMark {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
}

export interface RichTextNode {
  readonly type: string;
  readonly attrs?: Readonly<Record<string, unknown>>;
  readonly text?: string;
  readonly marks?: readonly RichTextMark[];
  readonly content?: readonly RichTextNode[];
}

export interface RichTextDoc {
  readonly type: 'doc';
  readonly content?: readonly RichTextNode[];
}
