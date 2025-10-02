import { FullCampaign, CampaignSummary, Channel, Market } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

type ManualOverrides = { primaryMarkets: Market[]; secondaryMarkets: Market[]; campaignTypes: string[] };

const DEFAULT_MARKET: Market = { name: 'United States', iso: 'US', browserLangs: ['en-US'] };
const DEFAULT_TYPE = 'PMax';
const DEFAULT_LANGUAGE = 'en-US';

// ===== API KEY HANDLING =====
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
  if (!key) throw new Error('Missing Gemini API key. Add VITE_GEMINI_API_KEY in Settings or paste your key in the app.');
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: key });
  return aiClient;
};
export const hasGeminiKey = (): boolean => !!getApiKey();

// ===== SHARED SCHEMAS =====
const marketSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    iso: { type: Type.STRING },
    browserLangs: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['name', 'iso', 'browserLangs'],
};

// ===== SUMMARY GENERATION (STEP 1) =====
const summarySchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    channel: { type: Type.STRING, enum: ['Google', 'Meta', 'TikTok'] },
    campaignName: { type: Type.STRING },
    campaignType: { type: Type.STRING },
    market: { ...marketSchema },
    languages: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['channel', 'campaignName', 'campaignType', 'market', 'languages'],
};
const summaryPlanSchema = { type: Type.ARRAY, items: summarySchema };
const SUMMARY_SYSTEM_INSTRUCTION = `You are an expert marketing strategist. Create a structured high-level campaign plan as JSON. Follow any manual parameters exactly. One language per campaign. No creative copy, only structure. Output must match the JSON schema.`;

const describeMarkets = (label: string, markets: Market[]) => {
  if (!markets.length) return `${label}: None`;
  const items = markets.map(m => {
    const langs = m.browserLangs?.length ? ` [langs: ${m.browserLangs.join(', ')}]` : '';
    return `${m.name} (${m.iso})${langs}`;
  });
  return `${label}: ${items.join(', ')}`;
};

const alignWithManualSelections = (
  summaries: CampaignSummary[],
  manualParams: ManualOverrides,
  channels: Channel[]
): CampaignSummary[] => {
  const manualTypes = manualParams.campaignTypes.filter(Boolean);
  const manualMarkets = [...manualParams.primaryMarkets, ...manualParams.secondaryMarkets].filter(Boolean);
  const channelPool = channels.length ? channels : summaries.map(s => s.channel).filter(Boolean);
  const ensureCount = Math.max(
    summaries.length || 0,
    manualTypes.length || 0,
    manualMarkets.length || 0,
    channelPool.length || 0,
    1
  );
  const base = summaries.length ? summaries : [];
  const next = [...base];
  while (next.length < ensureCount) {
    const index = next.length;
    const market = manualMarkets.length ? manualMarkets[index % manualMarkets.length] : (base[0]?.market || DEFAULT_MARKET);
    const type = manualTypes.length ? manualTypes[index % manualTypes.length] : (base[0]?.campaignType || DEFAULT_TYPE);
    const channel = channelPool.length ? channelPool[index % channelPool.length] : (base[0]?.channel || 'Google');
    const languages = market.browserLangs?.length ? [market.browserLangs[0]] : (base[0]?.languages?.length ? base[0].languages : [DEFAULT_LANGUAGE]);
    next.push({
      id: self.crypto.randomUUID(),
      channel,
      campaignName: `${market.name} ${type} Campaign`,
      campaignType: type,
      market,
      languages,
    });
  }
  return next.map((summary, idx) => {
    let updated = { ...summary };
    if (channelPool.length) {
      updated.channel = channelPool[idx % channelPool.length] || updated.channel;
    }
    if (manualTypes.length) {
      updated.campaignType = manualTypes[idx % manualTypes.length] || updated.campaignType;
    }
    if (manualMarkets.length) {
      const market = manualMarkets[idx % manualMarkets.length];
      updated.market = market;
      if (!updated.languages?.length || manualMarkets.length) {
        updated.languages = market.browserLangs?.length ? [market.browserLangs[0]] : (updated.languages?.length ? updated.languages : [DEFAULT_LANGUAGE]);
      }
    }
    return updated;
  });
};

export const generateCampaignSummary = async (
  brief: string,
  channels: Channel[],
  manualParams?: ManualOverrides
): Promise<CampaignSummary[]> => {
  const hasManual = !!(
    manualParams && (
      manualParams.primaryMarkets.length ||
      manualParams.secondaryMarkets.length ||
      manualParams.campaignTypes.length
    )
  );
  const manualSection = hasManual
    ? `Manual Parameters (follow exactly):\n${describeMarkets('- Primary Markets', manualParams!.primaryMarkets)}\n${describeMarkets('- Secondary Markets', manualParams!.secondaryMarkets)}\n- Campaign Types: ${manualParams!.campaignTypes.length ? manualParams!.campaignTypes.join(', ') : 'None'}`
    : '';
  const channelLine = channels.length ? `Primary Channels: ${channels.join(', ')}` : 'Primary Channels: None provided';
  const finalPrompt = hasManual
    ? `${channelLine}\n\n${manualSection}\n\nCreative Brief:\n${brief}`
    : `${channelLine}.\n\nCreative Brief:\n${brief}`;
  const response = await ensureClient().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: finalPrompt,
    config: { systemInstruction: SUMMARY_SYSTEM_INSTRUCTION, responseMimeType: 'application/json', responseSchema: summaryPlanSchema },
  });
  const text = (response.text || '').trim();
  if (!text) throw new Error('Empty response');
  const arr = JSON.parse(text) as Omit<CampaignSummary, 'id'>[];
  const summaries = arr.map(s => ({ ...s, id: self.crypto.randomUUID() }));
  if (!hasManual || !manualParams) {
    return summaries;
  }
  return alignWithManualSelections(summaries, manualParams, channels);
};

// ===== DETAILS GENERATION (STEP 2) =====
const googleAdSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    finalUrl: { type: Type.STRING },
    headlines: { type: Type.ARRAY, items: { type: Type.STRING } },
    descriptions: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    assignedAdGroupId: { type: Type.STRING },
    assignedTargets: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { source: { type: Type.STRING, enum: ['plan','external'] }, campaignId: { type: Type.STRING }, adGroupId: { type: Type.STRING }, campaignName: { type: Type.STRING }, adGroupName: { type: Type.STRING } } } },
  },
  required: ['finalUrl', 'headlines', 'descriptions'],
};
const googleAdGroupSchema = { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, ads: { type: Type.ARRAY, items: googleAdSchema } }, required: ['name', 'ads'] };
const googleAssetGroupSchema = { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, finalUrl: { type: Type.STRING }, headlines: { type: Type.ARRAY, items: { type: Type.STRING } }, longHeadlines: { type: Type.ARRAY, items: { type: Type.STRING } }, descriptions: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['name','finalUrl','headlines','longHeadlines','descriptions'] };

const fullCampaignSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    channel: { type: Type.STRING, enum: ['Google','Meta','TikTok'] },
    campaignName: { type: Type.STRING },
    campaignType: { type: Type.STRING },
    market: { ...marketSchema },
    languages: { type: Type.ARRAY, items: { type: Type.STRING } },
    googleAds: { type: Type.OBJECT, properties: { hotelPropertyFeed: { type: Type.STRING }, assetGroups: { type: Type.ARRAY, items: googleAssetGroupSchema }, adGroups: { type: Type.ARRAY, items: googleAdGroupSchema }, ads: { type: Type.ARRAY, items: googleAdSchema } } },
    meta: { type: Type.OBJECT, properties: { adSets: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, ads: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, primaryText: { type: Type.STRING }, headline: { type: Type.STRING }, description: { type: Type.STRING } }, required: ['primaryText','headline','description'] } } }, required: ['name','ads'] } } } },
    tikTok: { type: Type.OBJECT, properties: { adGroups: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, ads: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, adText: { type: Type.STRING } }, required: ['adText'] } } }, required: ['name','ads'] } } } },
  },
  required: ['channel','campaignName','campaignType','market','languages'],
};
const fullPlanSchema = { type: Type.ARRAY, items: fullCampaignSchema };
const DETAILS_SYSTEM_INSTRUCTION = `Expand the campaign plan and original brief into fully detailed creative assets following channel-specific rules. Use required structures and IDs. Output must match schema.`;

export const generateCampaignDetails = async (summaries: CampaignSummary[], brief: string): Promise<FullCampaign[]> => {
  const normalized = summaries.map(s => (s.channel === 'Google' && /brand/i.test(s.campaignType) && !/pmax|performance\s*max|hotel/i.test(s.campaignType)) ? { ...s, campaignType: 'Brand Search' } : s);
  const prompt = `Original Brief: """${brief}"""\n\nCampaign Summaries to complete: """${JSON.stringify(normalized, null, 2)}"""`;
  const response = await ensureClient().models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction: DETAILS_SYSTEM_INSTRUCTION, responseMimeType: 'application/json', responseSchema: fullPlanSchema } });
  const text = (response.text || '').trim();
  if (!text) throw new Error('Empty response');
  let campaigns = JSON.parse(text) as FullCampaign[];
  // Ensure IDs exist
  campaigns = campaigns.map(c => ({
    ...c,
    googleAds: c.googleAds ? {
      ...c.googleAds,
      assetGroups: c.googleAds.assetGroups?.map(ag => ({ ...ag, id: ag.id || self.crypto.randomUUID() })),
      adGroups: c.googleAds.adGroups?.map(g => ({ ...g, id: g.id || self.crypto.randomUUID(), ads: g.ads?.map(a => ({ ...a, id: a.id || self.crypto.randomUUID() })) })),
    } : undefined,
  }));
  // Lift nested ads when campaign-level ads missing
  campaigns = campaigns.map(c => {
    if (c.channel !== 'Google' || !c.googleAds) return c;
    const groups = c.googleAds.adGroups || [];
    const existingAds: any[] = (c as any).googleAds?.ads || [];
    if (existingAds.length === 0 && groups.some(g => (g.ads || []).length > 0)) {
      const flat = groups.flatMap(g => (g.ads || []).map(ad => ({ ...ad, assignedAdGroupId: g.id })));
      return { ...c, googleAds: { ...c.googleAds, ads: flat, adGroups: groups.map(g => ({ ...g, ads: [] })) } } as FullCampaign;
    }
    return c;
  });
  // Normalize legacy assignment fields
  campaigns = campaigns.map(c => {
    if (c.channel !== 'Google' || !c.googleAds) return c;
    const ads: any[] = ((c as any).googleAds || {}).ads || [];
    const normAds = ads.map(ad => {
      let targets = ad.assignedTargets || [];
      if (ad.assignedAdGroupId && !targets.some((t:any)=> t.source==='plan' && t.adGroupId===ad.assignedAdGroupId)) {
        targets = [...targets, { source:'plan', adGroupId: ad.assignedAdGroupId }];
      }
      if (ad.assignedExternal && !targets.some((t:any)=> t.source==='external' && t.campaignName===ad.assignedExternal.campaignName && t.adGroupName===ad.assignedExternal.adGroupName)) {
        targets = [...targets, { source:'external', campaignName: ad.assignedExternal.campaignName, adGroupName: ad.assignedExternal.adGroupName }];
      }
      return { ...ad, assignedTargets: targets };
    });
    return { ...c, googleAds: { ...(c.googleAds as any), ads: normAds } } as FullCampaign;
  });
  return campaigns;
};

// ===== Guided hint =====
export const generateGuidedHint = async (brief: string, present: { market: boolean; type: boolean; hotel: boolean; angle: boolean }): Promise<string> => {
  const sys = `You are a friendly UX guide helping users craft a marketing campaign prompt. Output ONE short hint (<=140 chars).`;
  const prompt = `Brief:\n"""${brief.slice(0,1000)}"""\n\nDetected:\n- market: ${present.market}\n- type: ${present.type}\n- hotel: ${present.hotel}\n- angle: ${present.angle}`;
  try {
    const res = await ensureClient().models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction: sys } });
    const text = (res.text || '').trim();
    return text || 'Tell us more about your campaign — start anywhere and I\'ll guide you ✍️';
  } catch {
    return 'Hint unavailable right now — using manual guidance instead.';
  }
};

// ===== Asset generation helpers =====
export type AssetType = 'headline' | 'description' | 'long headline' | 'ad group name' | 'asset group name' | 'keyword' | 'primary text' | 'meta headline' | 'meta description' | 'ad set name' | 'ad text' | 'tiktok ad group name';

export const generateCreativeAsset = async (brief: string, campaign: FullCampaign, assetType: AssetType, existingAssets?: string[], assetToRewrite?: string): Promise<string> => {
  let instruction = `Generate one new ${assetType} for a ${campaign.channel} campaign.`;
  if (assetToRewrite) instruction = `Rewrite the following ${assetType} for a ${campaign.channel} campaign: "${assetToRewrite}"`;
  const prompt = `Original Brief: "${brief}"\nChannel: "${campaign.channel}"\nCampaign Name: "${campaign.campaignName}"\nCampaign Type: "${campaign.campaignType}"\nMarket: "${campaign.market.name}"\nLanguage: "${campaign.languages.join(', ')}"\n${existingAssets ? `Existing ${assetType}s: "${existingAssets.join('", ')}"` : ''}\n\nTask: ${instruction}\nReturn only the generated text.`;
  const res = await ensureClient().models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
  return (res.text || '').trim().replace(/^"|"$/g, '') || 'New asset';
};

export const generateGoogleAdGroup = async (brief: string, summary: CampaignSummary) => {
  const schema = { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, ads: { type: Type.ARRAY, items: googleAdSchema } }, required: ['name','ads'] };
  const sys = 'Create one Google Search ad group with at least one ad based on the brief and summary.';
  const prompt = `Brief: "${brief}"\nSummary: ${JSON.stringify(summary)}`;
  const res = await ensureClient().models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction: sys, responseMimeType: 'application/json', responseSchema: schema } });
  const txt = (res.text || '').trim();
  const obj = JSON.parse(txt);
  return { ...obj, id: obj.id || self.crypto.randomUUID() };
};

export const generateGoogleSearchAd = async (brief: string, summary: CampaignSummary) => {
  const schema = googleAdSchema;
  const sys = 'Create one Google Search ad (headlines, descriptions, finalUrl) based on the brief and summary.';
  const prompt = `Brief: "${brief}"\nSummary: ${JSON.stringify(summary)}`;
  const res = await ensureClient().models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction: sys, responseMimeType: 'application/json', responseSchema: schema } });
  const txt = (res.text || '').trim();
  const ad = JSON.parse(txt);
  return { ...ad, id: ad.id || self.crypto.randomUUID() };
};

// ===== Banner copy for Creative Generator =====
export const generateBannerCopy = async (prompt: string): Promise<{ heading: string; subtext: string; cta: string }> => {
  const schema = { type: Type.OBJECT, properties: { heading: { type: Type.STRING }, subtext: { type: Type.STRING }, cta: { type: Type.STRING } }, required: ['heading','subtext','cta'] };
  const sys = 'You are a senior display ad copywriter. Create concise copy for banners from a brief. No emojis. Return JSON matching schema.';
  const contents = `Brief for banners:\n"""${prompt.slice(0, 2000)}"""`;
  const res = await ensureClient().models.generateContent({ model: 'gemini-2.5-flash', contents, config: { systemInstruction: sys, responseMimeType: 'application/json', responseSchema: schema } });
  const txt = (res.text || '').trim();
  try { return JSON.parse(txt); } catch { return { heading: 'Special Offer', subtext: 'Save on your next stay when you book direct.', cta: 'Book Now' }; }
};
