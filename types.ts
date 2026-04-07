
export interface ObjectCount {
  name: string;
  count: number;
  type: 'living' | 'non-living';
}

export interface AnalysisResult {
  items: ObjectCount[];
  summary: string;
  mediaType?: 'image' | 'video';
}

export type AppState = 'idle' | 'capturing' | 'analyzing' | 'result';

declare global {
  interface Window {
    aistudio?: {
      openSelectKey?: () => Promise<void>;
    };
  }
}
