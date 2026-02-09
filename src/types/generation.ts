export type VariationStyle =
  | "Storytelling"
  | "Professional"
  | "Short & Punchy"
  | "Data-Driven"
  | "Conversational"
  | "Provocative";

export interface TextVariation {
  id: string;
  style: VariationStyle;
  content: string;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
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
