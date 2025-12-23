import { GoogleGenAI } from "@google/genai";
import { Patient, Observation, Encounter } from "../types";

// Note: In a real app, this key comes from process.env.API_KEY.
// The code assumes the environment is set up correctly.
let ai: GoogleGenAI | null = null;

try {
  if (process.env.API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize Gemini client", e);
}

export const generateClinicalSummary = async (
  patient: Patient,
  encounters: Encounter[],
  observations: Observation[]
): Promise<string> => {
  if (!ai) {
    return "AI Service Unavailable: API Key not configured.";
  }

  const contextData = JSON.stringify({
    patient: {
      name: patient.name[0].given.join(" ") + " " + patient.name[0].family,
      gender: patient.gender,
      age: new Date().getFullYear() - new Date(patient.birthDate).getFullYear(),
    },
    recentEncounters: encounters.slice(0, 3).map(e => ({
      date: e.period?.start,
      reason: e.reasonCode?.[0]?.text || "General Checkup"
    })),
    recentVitals: observations.slice(0, 5).map(o => ({
      test: o.code.text,
      value: o.valueQuantity?.value || o.valueString,
      unit: o.valueQuantity?.unit
    }))
  }, null, 2);

  const prompt = `
    You are an expert clinical AI assistant using FHIR data.
    Analyze the following JSON data representing a patient, their recent encounters, and observations.
    
    Data:
    ${contextData}

    Task:
    1. Write a concise clinical summary (max 3 sentences).
    2. Identify any trending risks based on the vitals.
    3. Suggest a priority level (P1-P4) rationale.
    
    Format:
    Return plain text with clear headings using Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate AI summary. Please try again later.";
  }
};
