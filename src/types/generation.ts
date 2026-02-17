export type VariationStyle = string;

export interface TextVariation {
  id: string;
  style: VariationStyle;
  content: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  base64?: string;
  prompt: string;
  styleId?: string;
  styleName?: string;
}

export interface GenerationSession {
  id: string;
  idea: string;
  textVariations: TextVariation[];
  images: GeneratedImage[];
  selectedTextId?: string;
  selectedImageId?: string;
  createdAt: Date;
}
