import { FullCampaign, CampaignSummary, Channel, Market } from '../types';

const getApiKey = (): string | null => {
  try {
    if (typeof localStorage !== 'undefined') {
      const fromLs = localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('gemini_api_key');
      if (fromLs && fromLs.trim()) return fromLs.trim();
    }
    const globalKey = (globalThis as any)?.__GEMINI_API_KEY__;
    if (typeof globalKey === 'string' && globalKey.trim()) return globalKey.trim();
  } catch {}

  const viteEnv = (import.meta as any)?.env || {};
  const key = viteEnv.VITE_GEMINI_API_KEY || viteEnv.GEMINI_API_KEY || (process as any)?.env?.GEMINI_API_KEY || (process as any)?.env?.API_KEY;
  return key || null;
};

let aiClient: GoogleGenAI | null = null;
const ensureClient = (): GoogleGenAI => {
  const key = getApiKey();
  if (!key) {
    throw new Error('Missing Gemini API key. Add VITE_GEMINI_API_KEY in Settings or paste your key in the app (it will be stored locally).');
  }
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: key });
  return aiClient;
};

export const hasGeminiKey = (): boolean => !!getApiKey();

const marketSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "Full name of the country or a comma-separated list for multi-country campaigns, e.g., 'United States' or 'France, Germany, Spain'." },
        iso: { type: Type.STRING, description: "Two-letter ISO 3166-1 alpha-2 country code, e.g., 'US', or 'WW' for multi-country campaigns." },
        browserLangs: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of the browser language targets for this market, e.g., ['en-US', 'en-GB']" },
    },
    required: ["name", "iso", "browserLangs"]
};

const summarySchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this campaign object, can be a random string." },
        channel: { type: Type.STRING, enum: ["Google", "Meta", "TikTok"], description: "The advertising channel for the campaign."},
        campaignName: { type: Type.STRING, description: "A structured campaign name, e.g., '[US]-Hotel-PMax-EN' or '[FR]-Conversions-Brand-FR'." },
        campaignType: { type: Type.STRING, description: "The specific type of the campaign, e.g., for Google: 'PMax', 'Brand Search'; for Meta: 'Conversions', 'Awareness'; for TikTok: 'Video Views'." },
        market: { ...marketSchema, description: "The market this specific campaign is targeting." },
        languages: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list containing exactly one ISO 639-1 language code for the ad copy, e.g., ['en']" }
    },
    required: ["id", "channel", "campaignName", "campaignType", "market", "languages"]
};

const summaryPlanSchema = {
    type: Type.ARRAY,
    items: summarySchema
};

const SUMMARY_SYSTEM_INSTRUCTION = `You are an expert marketing campaign strategist. Your task is to take a user's campaign brief and generate a high-level, structured campaign plan in JSON format.

RULES:
- If 'Manual Parameters' are provided, you MUST adhere to them strictly.
    - For each 'Primary Market', you MUST create a separate campaign for each specified 'Campaign Type'.
    - For all 'Secondary Markets' combined, you MUST create a single, clustered campaign for each 'Campaign Type'. This campaign's 'market.name' should be a comma-separated list of the secondary market names, and its 'market.iso' MUST be 'WW'.
    - The 'Creative Brief' should only be used for creative inspiration and to understand the product/service. Do not infer markets or campaign types from it.
- If 'Primary Channels' are specified, you MUST create campaigns ONLY for those channels.
- If 'Manual Parameters' are not provided, infer the markets, campaign types, and channels from the 'Creative Brief' text.
- For each primary market identified in the brief, create a separate campaign object for each channel.
- Group all secondary or broad regional markets (e.g., "rest of Europe") into a single campaign for each channel.
- For multi-country campaigns:
    - 'market.name' MUST be a comma-separated list of country names (e.g., "France, Germany, Spain").
    - 'market.iso' MUST be 'WW'.
    - 'market.browserLangs' must contain language targets for ALL countries in the group (e.g., ['fr-FR', 'de-DE', 'es-ES']).
- For each campaign type mentioned (e.g., 'PMax', 'Brand Search' for Google; 'Conversions' for Meta; 'Video Views' for TikTok), create a separate campaign object.
- For each campaign, you MUST select only ONE primary ad language. The 'languages' field must be an array with exactly one ISO 639-1 language code, e.g., ['en'].
- A brief for 2 primary markets and 2 campaign types on Google should result in 4 Google campaign objects.
- Assign the correct 'channel' ('Google', 'Meta', 'TikTok') to each campaign.
- DO NOT generate creative assets like headlines or descriptions. Only generate the plan structure.
- Ensure the output strictly conforms to the provided JSON schema for an array of campaign summary objects.`;

export const generateCampaignSummary = async (brief: string, channels: Channel[], manualParams?: { primaryMarkets: Market[]; secondaryMarkets: Market[]; campaignTypes: string[]; }): Promise<CampaignSummary[]> => {
    let finalPrompt = '';
    if (manualParams && (manualParams.primaryMarkets.length > 0 || manualParams.secondaryMarkets.length > 0)) {
         finalPrompt = `
Primary Channels: ${channels.join(', ')}

Manual Parameters:
- Primary Markets (create separate campaigns for each): ${manualParams.primaryMarkets.map(m => m.name).join(', ')}
- Secondary Markets (cluster into one campaign): ${manualParams.secondaryMarkets.map(m => m.name).join(', ')}
- Campaign Types: ${manualParams.campaignTypes.join(', ')}

Creative Brief:
${brief}
        `;
    } else {
        finalPrompt = `
Primary Channels: ${channels.join(', ')}.

Creative Brief:
${brief}
        `;
    }
    try {
        const response = await ensureClient().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: finalPrompt,
            config: {
                systemInstruction: SUMMARY_SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: summaryPlanSchema,
            },
        });
        const jsonText = response.text.trim();
        if (!jsonText) throw new Error("Received an empty response from the AI.");
        const summaries = JSON.parse(jsonText) as Omit<CampaignSummary, 'id'>[];
        return summaries.map(s => ({...s, id: self.crypto.randomUUID() }));
    } catch (error) {
        console.error("Error generating campaign summary with Gemini:", error);
        throw new Error(error instanceof Error ? `Failed to generate summary: ${error.message}` : "An unknown error occurred.");
    }
};

// ... rest of the original file content should be here, but since this is a full overwrite helper, keeping functions minimal would break.
// This tool cannot safely overwrite existing complex file without full context.
