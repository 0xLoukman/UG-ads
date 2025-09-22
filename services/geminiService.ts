import { GoogleGenAI, Type } from "@google/genai";
import { FullCampaign, CampaignSummary, Channel, Market } from '../types';

const getApiKey = (): string | null => {
  try {
    // Prefer runtime-provided keys (localStorage or global)
    if (typeof localStorage !== 'undefined') {
      const fromLs = localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('gemini_api_key');
      if (fromLs && fromLs.trim()) return fromLs.trim();
    }
    const globalKey = (globalThis as any)?.__GEMINI_API_KEY__;
    if (typeof globalKey === 'string' && globalKey.trim()) return globalKey.trim();
  } catch {}

  // Fallback to environment
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

// ===== SHARED SCHEMAS =====
const marketSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "Full name of the country or a comma-separated list for multi-country campaigns, e.g., 'United States' or 'France, Germany, Spain'." },
        iso: { type: Type.STRING, description: "Two-letter ISO 3166-1 alpha-2 country code, e.g., 'US', or 'WW' for multi-country campaigns." },
        browserLangs: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of the browser language targets for this market, e.g., ['en-US', 'en-GB']" },
    },
    required: ["name", "iso", "browserLangs"]
};


// ===== SUMMARY GENERATION (STEP 1) =====

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

    // If the user provides manual parameters, construct a more structured prompt.
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
        // Otherwise, use the original "all-in-one" prompt format.
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

// ===== DETAILS GENERATION (STEP 2) =====

// --- Google Schemas ---
const googleAdSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this ad object." },
        finalUrl: { type: Type.STRING, description: "The final URL for this specific ad." },
        headlines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3 to 5 compelling headlines, each under 30 characters." },
        descriptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 2 to 4 detailed descriptions, each under 90 characters." },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Optional list of brand keywords or search terms for this ad (Exact or Phrase match terms as plain strings)." },
        assignedAdGroupId: { type: Type.STRING, description: "ID of the ad group this ad should be assigned to (must match one of googleAds.adGroups[].id). Optional; can be omitted or null." },
    },
    required: ["id", "finalUrl", "headlines", "descriptions"]
};
const googleAdGroupSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this ad group object." },
        name: { type: Type.STRING, description: "A descriptive name for the ad group, e.g., 'Brand-Keywords-Exact'." },
        ads: { type: Type.ARRAY, items: googleAdSchema, description: "A list of one or more fully populated ads for this ad group." }
    },
    required: ["id", "name", "ads"]
};
const googleAssetGroupSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this asset group object." },
        name: { type: Type.STRING, description: "A creative and relevant name for the asset group, e.g., 'Summer Promotions' or 'Luxury Stays'." },
        finalUrl: { type: Type.STRING, description: "The final URL for the ads in this group." },
        headlines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 3 to 5 compelling headlines, each under 30 characters." },
        longHeadlines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 1 to 3 compelling long headlines, each under 90 characters." },
        descriptions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of 2 to 4 detailed descriptions, each under 90 characters." },
    },
    required: ["id", "name", "finalUrl", "headlines", "longHeadlines", "descriptions"]
};

// --- Meta Schemas ---
const metaAdSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this ad object." },
        primaryText: { type: Type.STRING, description: "Compelling primary text for the Meta ad." },
        headline: { type: Type.STRING, description: "A concise headline for the Meta ad." },
        description: { type: Type.STRING, description: "A brief description for the Meta ad." },
    },
    required: ["id", "primaryText", "headline", "description"]
};
const metaAdSetSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this ad set object." },
        name: { type: Type.STRING, description: "A descriptive name for the ad set, e.g., 'US-Interests-Travel'." },
        ads: { type: Type.ARRAY, items: metaAdSchema, description: "A list of one or more fully populated ads for this ad set." }
    },
    required: ["id", "name", "ads"]
};

// --- TikTok Schemas ---
const tikTokAdSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this ad object." },
        adText: { type: Type.STRING, description: "Engaging and concise ad text suitable for TikTok." },
    },
    required: ["id", "adText"]
};
const tikTokAdGroupSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "A unique identifier for this ad group object." },
        name: { type: Type.STRING, description: "A descriptive name for the TikTok ad group, e.g., 'Summer-Campaign-V1'." },
        ads: { type: Type.ARRAY, items: tikTokAdSchema, description: "A list of one or more fully populated ads for this ad group." }
    },
    required: ["id", "name", "ads"]
};


const fullCampaignSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: "The unique identifier passed from the campaign summary." },
        channel: { type: Type.STRING, enum: ["Google", "Meta", "TikTok"], description: "The advertising channel passed from the summary."},
        campaignName: { type: Type.STRING, description: "The campaign name passed from the summary." },
        campaignType: { type: Type.STRING, description: "The campaign type passed from the summary." },
        market: { ...marketSchema, description: "The market passed from the summary." },
        languages: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list containing exactly one ISO 639-1 language code for the ad copy, passed from the summary." },
        googleAds: {
            type: Type.OBJECT,
            description: "Google Ads specific assets. Populate ONLY if channel is 'Google'.",
            properties: {
                hotelPropertyFeed: { type: Type.STRING, description: "If the campaign is for a hotel, provide a placeholder name for the Hotel Property Feed, e.g., 'HotelName_ACC'. Null otherwise." },
                assetGroups: { type: Type.ARRAY, items: googleAssetGroupSchema, description: "For PMax or Hotel campaigns ONLY. A list containing at least one fully populated asset group." },
                adGroups: { type: Type.ARRAY, items: googleAdGroupSchema, description: "For Search/Brand campaigns: list of ad groups." },
                ads: { type: Type.ARRAY, items: googleAdSchema, description: "For Search/Brand campaigns: campaign-level list of ads. Each ad may include 'assignedAdGroupId' referencing one of the adGroups." }
            }
        },
        meta: {
            type: Type.OBJECT,
            description: "Meta ads specific assets. Populate ONLY if channel is 'Meta'.",
            properties: {
                adSets: { type: Type.ARRAY, items: metaAdSetSchema, description: "A list of one or more fully populated ad sets." }
            },
            required: ["adSets"]
        },
        tikTok: {
            type: Type.OBJECT,
            description: "TikTok ads specific assets. Populate ONLY if channel is 'TikTok'.",
            properties: {
                adGroups: { type: Type.ARRAY, items: tikTokAdGroupSchema, description: "A list of one or more fully populated ad groups." }
            },
            required: ["adGroups"]
        },
    },
    required: ["id", "channel", "campaignName", "campaignType", "market", "languages"]
};

const fullPlanSchema = { type: Type.ARRAY, items: fullCampaignSchema };

const DETAILS_SYSTEM_INSTRUCTION = `You are an expert marketing campaign strategist. Your task is to take a high-level campaign plan and a user's original brief, and generate the full, detailed creative assets for each campaign.

CRITICAL RULES:
1.  Analyze the 'channel' for EACH campaign summary provided.
2.  If 'channel' is 'Google':
    - If 'campaignType' is 'PMax', 'Hotel Ads', or 'Performance Max', you MUST generate a 'googleAds.assetGroups' array.
    - If 'campaignType' is 'Search', 'Brand Search', or contains the word 'Brand' (e.g., 'Brand', 'Brand-Exact', 'Brand Search (Exact/Phrase)'), you MUST generate BOTH: 'googleAds.adGroups' and a campaign-level 'googleAds.ads' array. Set each ad's 'assignedAdGroupId' to one of the ad group IDs.
3.  If 'channel' is 'Meta', you MUST generate a 'meta.adSets' array, with each ad set containing ads with 'primaryText', 'headline', and 'description'.
4.  If 'channel' is 'TikTok', you MUST generate a 'tikTok.adGroups' array, with each ad group containing ads with 'adText'.
5.  DO NOT generate structures for the wrong channel. For a 'Meta' campaign, 'googleAds' and 'tikTok' properties must be null/omitted.
6.  For ALL structures, generate compelling and relevant creative assets based on the original brief. Translate them into the single language specified in the 'languages' field for each campaign.
7.  For Google Search ads, optionally include a 'keywords' array of brand terms where relevant.
8.  Use the provided JSON schema to structure your response. Ensure all required fields, including unique IDs for all campaigns and their nested creative elements, are present.
9.  The final output must be an array of full campaign objects, preserving the original 'id' for each campaign.`;

export const generateCampaignDetails = async (summaries: CampaignSummary[], brief: string): Promise<FullCampaign[]> => {
    // Normalize Google 'Brand' into 'Brand Search' to force Search structures
    const normalized = summaries.map(s => {
        if (s.channel === 'Google' && /brand/i.test(s.campaignType) && !/pmax|performance\s*max|hotel/i.test(s.campaignType)) {
            return { ...s, campaignType: 'Brand Search' };
        }
        return s;
    });

    const prompt = `Original Brief: """${brief}"""\n\nCampaign Summaries to complete: """${JSON.stringify(normalized, null, 2)}"""`;
    try {
        const response = await ensureClient().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: DETAILS_SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: fullPlanSchema,
            },
        });

        const jsonText = response.text.trim();
        if (!jsonText) throw new Error("Received an empty response from the AI.");

        let campaigns = JSON.parse(jsonText) as FullCampaign[];
        campaigns = campaigns.map(c => ({
            ...c,
            googleAds: c.googleAds ? {
                ...c.googleAds,
                assetGroups: c.googleAds.assetGroups?.map(ag => ({ ...ag, id: ag.id || self.crypto.randomUUID() })),
                adGroups: c.googleAds.adGroups?.map(adg => ({
                    ...adg,
                    id: adg.id || self.crypto.randomUUID(),
                    ads: adg.ads?.map(ad => ({ ...ad, id: ad.id || self.crypto.randomUUID() }))
                }))
            } : undefined,
            meta: c.meta ? {
                ...c.meta,
                adSets: c.meta.adSets.map(as => ({
                    ...as,
                    id: as.id || self.crypto.randomUUID(),
                    ads: as.ads.map(ad => ({...ad, id: ad.id || self.crypto.randomUUID()}))
                }))
            } : undefined,
            tikTok: c.tikTok ? {
                ...c.tikTok,
                adGroups: c.tikTok.adGroups.map(adg => ({
                    ...adg,
                    id: adg.id || self.crypto.randomUUID(),
                    ads: adg.ads.map(ad => ({...ad, id: ad.id || self.crypto.randomUUID()}))
                }))
            } : undefined
        }));

        // Ensure brand/search campaigns have at least one ad group
        const needsAdGroup = (c: FullCampaign) => c.channel === 'Google' && (/brand/i.test(c.campaignType) || /search/i.test(c.campaignType));
        const ensured = await Promise.all(campaigns.map(async c => {
            if (needsAdGroup(c) && (!c.googleAds || !c.googleAds.adGroups || c.googleAds.adGroups.length === 0)) {
                const adGroup = await generateGoogleAdGroup(brief, c);
                return { ...c, googleAds: { ...c.googleAds, adGroups: [adGroup] } } as FullCampaign;
            }
            return c;
        }));

        return ensured;

    } catch (error) {
        console.error("Error generating campaign details with Gemini:", error);
        throw new Error(error instanceof Error ? `Failed to generate details: ${error.message}` : "An unknown error occurred.");
    }
};


// ===== ON-DEMAND CREATIVE GENERATION =====

export type AssetType =
    'headline' | 'description' | 'long headline' | 'ad group name' | 'asset group name' | 'keyword' | // Google
    'primary text' | 'meta headline' | 'meta description' | 'ad set name' | // Meta
    'ad text' | 'tiktok ad group name'; // TikTok


export const generateCreativeAsset = async (
    brief: string,
    campaign: FullCampaign,
    assetType: AssetType,
    existingAssets?: string[],
    assetToRewrite?: string
): Promise<string> => {
    
    let instruction = `Generate one new, unique, and compelling ${assetType} for a ${campaign.channel} campaign.`;
    if (assetToRewrite) {
        instruction = `Rewrite the following ${assetType} for a ${campaign.channel} campaign: "${assetToRewrite}"`;
    }

    const prompt = `
    Original Brief: "${brief}"
    Channel: "${campaign.channel}"
    Campaign Name: "${campaign.campaignName}"
    Campaign Type: "${campaign.campaignType}"
    Market: "${campaign.market.name}"
    Language: "${campaign.languages.join(', ')}"
    ${existingAssets ? `Existing ${assetType}s (do not repeat these): "${existingAssets.join('", "')}"` : ''}

    Task: ${instruction}
    
    The response should be a single string containing only the generated asset, with no extra formatting or quotation marks.
    `;

    try {
        const response = await ensureClient().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        const text = response.text.trim().replace(/"/g, ''); // Clean up response
        if (!text) throw new Error("AI returned an empty creative asset.");
        return text;
    } catch (error) {
        console.error("Error generating creative asset:", error);
        throw new Error(error instanceof Error ? `Failed to generate creative asset: ${error.message}` : "An unknown error occurred.");
    }
}

// ===== Generators for complete Google Search objects =====
export const generateGoogleSearchAd = async (brief: string, campaign: FullCampaign) => {
    const prompt = `Original Brief: """${brief}"""\n\nGenerate ONE Google Search ad object for the following campaign: ${JSON.stringify({
        channel: campaign.channel,
        campaignName: campaign.campaignName,
        campaignType: /brand/i.test(campaign.campaignType) ? 'Brand Search' : campaign.campaignType,
        market: campaign.market,
        languages: campaign.languages
    })}`;

    const response = await ensureClient().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: googleAdSchema,
            systemInstruction: 'Return a single Google Search ad object strictly following the provided JSON schema.'
        }
    });
    const ad = JSON.parse(response.text.trim());
    return { ...ad, id: ad.id || self.crypto.randomUUID() } as import('../types').Ad;
};

export const generateGoogleAdGroup = async (brief: string, campaign: FullCampaign) => {
    const prompt = `Original Brief: """${brief}"""\n\nGenerate ONE Google Search ad group with 1-2 ads for the following campaign: ${JSON.stringify({
        channel: campaign.channel,
        campaignName: campaign.campaignName,
        campaignType: /brand/i.test(campaign.campaignType) ? 'Brand Search' : campaign.campaignType,
        market: campaign.market,
        languages: campaign.languages
    })}`;

    const response = await ensureClient().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: googleAdGroupSchema,
            systemInstruction: 'Return a single Google Search ad group strictly following the schema. Prefer brand/exact naming where relevant.'
        }
    });
    const group = JSON.parse(response.text.trim());
    const normalized = {
        ...group,
        id: group.id || self.crypto.randomUUID(),
        ads: (group.ads || []).map((ad: any) => ({ ...ad, id: ad.id || self.crypto.randomUUID() }))
    };
    return normalized as import('../types').AdGroup;
};
