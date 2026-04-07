
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeImage = async (base64Image: string, targetObject?: string): Promise<AnalysisResult> => {
  return analyzeMedia(base64Image, 'image/jpeg', targetObject);
};

export const analyzeVideo = async (base64Video: string, mimeType: string, targetObject?: string): Promise<AnalysisResult> => {
  return analyzeMedia(base64Video, mimeType, targetObject);
};

const analyzeMedia = async (base64Data: string, mimeType: string, targetObject?: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  const isVideo = mimeType.startsWith('video/');
  const mediaTypeLabel = isVideo ? 'video' : 'image';

  const targetInstruction = targetObject 
    ? `FOCUS REQUIREMENT: The user is specifically interested in counting "${targetObject}". Ensure you prioritize identifying every instance of "${targetObject}" with high precision.`
    : "The user wants a general count of all visible objects.";

  const prompt = `
    Analyze this ${mediaTypeLabel} and provide a comprehensive, item-by-item count of all distinct objects visible.
    ${isVideo ? "For video, analyze the entire duration and provide a cumulative count of unique objects seen." : ""}
    
    ${targetInstruction}

    Categorization Rules:
    1. 'living': People, animals, and plants.
    2. 'non-living': Furniture, electronics (e.g., mobile phones, laptops), personal accessories (e.g., watches, glasses), vehicles, and household items.
    
    Detection Requirements:
    - Be extremely thorough. Look for small items like mobile phones, watches, keys, or pens.
    - CRITICAL DISTINCTION: Distinguish accurately between "Watches" (time-keeping devices with a face or digital screen) and "Bangles" or "Bracelets" (ornamental jewelry). Do NOT count bangles as watches.
    - Be specific with names (e.g., 'iPhone' or 'Smartphone' instead of just 'object', 'Analog Watch' instead of 'accessory').
    - If multiple of the same item exist, count them accurately (e.g., '3 Watches', '2 Mobile Phones').
    
    Return the results in a structured JSON format.
  `;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data.split(',')[1] || base64Data,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: 'The specific name of the object (e.g., Smartphone)' },
                count: { type: Type.INTEGER, description: 'Number of these specific objects found' },
                type: { 
                  type: Type.STRING, 
                  description: 'Whether it is living or non-living',
                  enum: ['living', 'non-living']
                },
              },
              required: ['name', 'count', 'type'],
            },
          },
          summary: { type: Type.STRING, description: 'A brief, friendly text summary of the findings' },
        },
        required: ['items', 'summary'],
      },
    },
  });

  try {
    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr) as AnalysisResult;
    return { ...result, mediaType: isVideo ? 'video' : 'image' };
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error(`Could not interpret the ${mediaTypeLabel} analysis results. The AI might have returned an invalid format.`);
  }
};
