
export interface Market {
  name: string;
  iso: string;
  browserLangs: string[];
}

// ===== GOOGLE =====
export interface AssetGroup {
  id: string;
  name:string;
  finalUrl: string;
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
}

export interface Ad {
    id: string;
    finalUrl: string;
    headlines: string[];
    descriptions: string[];
}

export interface AdGroup {
    id: string;
    name: string;
    ads: Ad[];
}

// ===== META =====
export interface MetaAd {
    id: string;
    primaryText: string;
    headline: string;
    description: string;
}

export interface MetaAdSet {
    id: string;
    name: string;
    ads: MetaAd[];
}

// ===== TIKTOK =====
export interface TikTokAd {
    id: string;
    adText: string;
}
export interface TikTokAdGroup {
    id: string;
    name: string;
    ads: TikTokAd[];
}


// ===== CAMPAIGN =====
export type Channel = 'Google' | 'Meta' | 'TikTok';

// Represents the high-level plan for user validation
export interface CampaignSummary {
  id: string; 
  channel: Channel;
  campaignName: string;
  campaignType: string;
  market: Market;
  languages: string[];
}

// Represents the full campaign with all generated assets, extending the summary
export interface FullCampaign extends CampaignSummary {
  googleAds?: {
    hotelPropertyFeed?: string;
    assetGroups?: AssetGroup[];
    adGroups?: AdGroup[];
  };
  meta?: {
    adSets: MetaAdSet[];
  };
  tikTok?: {
    adGroups: TikTokAdGroup[];
  };
}
