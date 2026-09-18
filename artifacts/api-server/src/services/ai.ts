import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY must be configured before starting the API server.");
}

const client = new GoogleGenAI({ apiKey });
const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const advisoryAIResponseSchema = z.object({
  recommended_crops: z.array(
    z.object({
      crop_name: z.string(),
      rank: z.number().int().positive(),
      suitability_reason: z.string(),
      estimated_yield_per_acre: z.string(),
      estimated_input_cost_per_acre: z.string(),
      estimated_revenue_per_acre: z.string(),
    }),
  ).min(1).max(4),
  fertilizer_plan: z.object({
    sowing_stage: z.string(),
    vegetative_stage: z.string(),
    flowering_stage: z.string(),
    maturity_stage: z.string(),
  }),
  irrigation_plan: z.object({
    sowing_stage: z.string(),
    vegetative_stage: z.string(),
    flowering_stage: z.string(),
    maturity_stage: z.string(),
    frequency_summary: z.string(),
  }),
  risk_factors: z.array(
    z.object({
      risk: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      mitigation: z.string(),
    }),
  ),
  confidence_score: z.number().min(0).max(1),
});

const diagnosticAIResponseSchema = z.object({
  likely_diagnosis: z.string(),
  possible_causes: z.array(
    z.object({
      cause: z.string(),
      type: z.enum([
        "fungal",
        "bacterial",
        "viral",
        "insect_pest",
        "nutrient_deficiency",
        "nematode",
        "weed_competition",
      ]),
      likelihood: z.enum(["low", "medium", "high"]),
    }),
  ).min(2),
  treatment_plan: z.object({
    organic_option: z.string(),
    chemical_option: z.string(),
    application_guidance: z.string(),
  }),
  prevention_tips: z.array(z.string()).min(1),
  confidence_score: z.number().min(0).max(1),
});

export class AIServiceError extends Error {
  readonly code = "AI_RESPONSE_INVALID";
  readonly status = 502;

  constructor(message = "The advisory service could not return a valid report.") {
    super(message);
    this.name = "AIServiceError";
  }
}

async function generateJson<T>(
  systemInstruction: string,
  prompt: string,
  schema: z.ZodType<T>,
): Promise<{ parsed: T; raw: unknown }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const retryInstruction =
        attempt === 0
          ? ""
          : "\nYour previous response did not match the required schema; return ONLY valid JSON matching the schema exactly.";
      const responsePromise = client.models.generateContent({
        model,
        contents: `${prompt}${retryInstruction}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      });
      const response = await Promise.race([
        responsePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini request timed out.")), 10000),
        ),
      ]);
      const rawText = response.text ?? "";
      const raw = JSON.parse(rawText);
      return { parsed: schema.parse(raw), raw };
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
  }
  throw new AIServiceError(lastError instanceof Error ? lastError.message : undefined);
}

const advisorySystemInstruction = `You are an expert agronomist and agricultural extension officer with deep practical knowledge of Indian farming conditions, soil science, crop rotation, and input economics. Give advice calibrated to smallholder and mid-size farmers.
Base every recommendation on the provided structured inputs. Recommend 2 to 4 crops ranked with reasons tied to the inputs. Never recommend a crop requiring unavailable irrigation. Flag previous-crop rotation risks. Make fertilizer and irrigation plans stage-based and quantified in practical units. Soil constraints override yield-maximizing choices. Output only JSON. Lower confidence when inputs are sparse or conflicting.`;

const diagnosticSystemInstruction = `You are an expert plant pathologist and entomologist specializing in farmer-reported symptoms without laboratory confirmation. Reason from symptoms, plant part, growth stage, onset, and weather. Always list at least two ranked possible causes. Distinguish disease, pest, and nutrient deficiency. Include organic/cultural and chemical treatment guidance where applicable and prevention tips. Lower confidence for vague symptoms and recommend local extension confirmation. Never recommend banned pesticides. Output only JSON.`;

export async function generateAdvisory(input: {
  season: string;
  soilTypeUsed: string;
  landAreaAcres: number;
  irrigationUsed: string;
  budgetTier: string;
  previousCrop?: string;
  knownSoilIssues: string[];
  farmerGoal: string;
  additionalNotes?: string;
}): Promise<{ parsed: z.infer<typeof advisoryAIResponseSchema>; raw: unknown }> {
  return generateJson(
    advisorySystemInstruction,
    `Generate a crop advisory for these farm inputs:
Season: ${input.season}
Soil type: ${input.soilTypeUsed}
Land area: ${input.landAreaAcres} acres
Irrigation availability: ${input.irrigationUsed}
Budget tier: ${input.budgetTier}
Previous crop: ${input.previousCrop ?? "none reported"}
Known soil issues: ${input.knownSoilIssues.join(", ") || "none reported"}
Farmer goal: ${input.farmerGoal}
Additional notes: ${input.additionalNotes ?? "none"}
Return JSON with recommended_crops, fertilizer_plan, irrigation_plan, risk_factors, confidence_score.`,
    advisoryAIResponseSchema,
  );
}

export async function generateDiagnostic(input: {
  affectedCrop: string;
  growthStage: string;
  symptomCategory?: string;
  symptomDescription: string;
  affectedPlantPart: string[];
  daysSinceSymptomsAppeared?: number;
  weatherRecent?: string;
}): Promise<{ parsed: z.infer<typeof diagnosticAIResponseSchema>; raw: unknown }> {
  return generateJson(
    diagnosticSystemInstruction,
    `Diagnose this crop health issue:
Affected crop: ${input.affectedCrop}
Growth stage: ${input.growthStage}
Farmer category: ${input.symptomCategory ?? "unsure"}
Symptoms: ${input.symptomDescription}
Affected plant parts: ${input.affectedPlantPart.join(", ")}
Days since symptoms appeared: ${input.daysSinceSymptomsAppeared ?? "not specified"}
Recent weather: ${input.weatherRecent ?? "not specified"}
Return JSON with likely_diagnosis, possible_causes, treatment_plan, prevention_tips, confidence_score.`,
    diagnosticAIResponseSchema,
  );
}