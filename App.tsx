import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FullCampaign, CampaignSummary, AssetGroup, AdGroup, Ad, Channel, MetaAdSet, TikTokAdGroup, MetaAd, TikTokAd, Market, AssetLibrary, BannerPreset } from "./types";
import { generateCampaignSummary, generateCampaignDetails, generateCreativeAsset, AssetType, generateGoogleAdGroup, generateGoogleSearchAd, generateBannerCopy, extractMarketsAndTypes } from "./services/geminiService";
import { WORLD_COUNTRIES, LANGUAGE_MAPPINGS } from "./countries";

type View = 'input' | 'summary' | 'details' | 'review';
type SortConfig = { key: keyof CampaignSummary | 'browserLangs'; direction: 'ascending' | 'descending' } | null;
type InputMode = 'prompt' | 'manual';
type ManualCampaignConfig = { primaryMarkets: Market[]; secondaryMarkets: Market[]; campaignTypes: string[]; };

interface GoogleAdAccount {
    id: string;
    name: string;
    customerId: string;
    timezone: string;
    currency: string;
}

const GOOGLE_AD_ACCOUNTS: GoogleAdAccount[] = [
    { id: 'acct-hotel-global', name: 'LuxeStay Hotels Global', customerId: '123-456-7890', timezone: 'America/New_York', currency: 'USD' },
    { id: 'acct-urban-collective', name: 'Urban Getaways Collective', customerId: '234-567-8901', timezone: 'Europe/London', currency: 'GBP' },
    { id: 'acct-pacific-retreats', name: 'Pacific Retreats Marketing', customerId: '345-678-9012', timezone: 'Asia/Singapore', currency: 'SGD' },
];

const ALL_CAMPAIGN_TYPES = ["PMax", "Brand", "Retargeting", "Hotel Ads"];
const COUNTRIES: Omit<Market, 'browserLangs'>[] = WORLD_COUNTRIES.map(c => ({ name: c.name, iso: c.code }));

const getMarketWithLangs = (country: Omit<Market, 'browserLangs'>): Market => {
    return { ...country, browserLangs: LANGUAGE_MAPPINGS[country.iso] || ['en-US'] };
};


// ===== ICONS =====
const TiktokIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.05-4.84-.95-6.43-2.88-1.59-1.93-2.02-4.35-1.1-6.58.92-2.23 3.12-3.82 5.5-4.04 1.45-.14 2.9-.03 4.33.22v4.22c-1.43-.24-2.86-.1-4.25.31-.9.27-1.78.69-2.59 1.23-.23.15-.44.32-.66.51-.3.25-.53.53-.74.83-.49.69-.78 1.52-.83 2.39-.05.87.16 1.76.6 2.55.43.79 1.09 1.46 1.9 1.87.81.41 1.72.58 2.62.53 1.14-.06 2.25-.45 3.18-1.11.93-.66 1.6-1.59 1.94-2.66.21-.69.3-1.42.3-2.14s.01-6.19.01-9.28c.01-1.3-.01-2.59.01-3.89.01-.13.08-.26.19-.33.21-.13.43-.23.66-.31.2-.07.4-.12.6-.19.28-.09.56-.2.84-.29.14-.05.28-.09.42-.14.28-.1.56-.2.83-.31v-4.2z"></path>
    </svg>
);
const MetaIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M22.09,18.84,20.25,22a.75.75,0,0,1-1-.44L16.45,15.5,12,19V5l4.45-3.5,2.8,6.06a.75.75,0,0,1-1,.44L16,6.53,13.5,9.85l3.65,7.89L18.89,14a.75.75,0,0,1,1,.44l2.21,4.42ZM3.91,18.84,5.75,22a.75.75,0,0,0,1-.44L9.55,15.5,12,19V5L7.55,1.5,4.75,7.56a.75.75,0,0,0,1,.44L8,6.53,10.5,9.85,6.85,17.74,5.11,14a.75.75,0,0,0-1-.44L1.9,18.84Z"></path>
    </svg>
);
const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
    </svg>
);
const BingIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M6 3h4.2c3.2 0 5.3 1.7 5.3 4.4 0 1.6-.9 3-2.5 3.8 2 .6 3.3 2.1 3.3 4.2 0 3-2.5 5.1-6.2 5.1H6V3zm4 6.8c1.6 0 2.5-.8 2.5-2 0-1.2-.9-2-2.5-2H8.6v4H10zm.3 7.4c2 0 3.1-.9 3.1-2.3s-1.1-2.3-3.1-2.3H8.6v4.6H10.3z" />
    </svg>
);
const SparklesIcon = ({className = "w-5 h-5"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L9.27 9.27L3 12l6.27 2.73L12 21l2.73-6.27L21 12l-6.27-2.73L12 3z"/><path d="M5 8l1.5 3.5L10 13l-3.5 1.5L5 18"/><path d="M14 6l1.5 3.5L19 11l-3.5 1.5L14 16"/></svg>;
const ErrorIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const SpinnerIcon = ({className = "h-5 w-5 text-white"}) => <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const PlusIcon = ({className = "w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = ({className = "w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const EditIcon = ({className="w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BackIcon = ({className="w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const ChevronDownIcon = ({className="w-4 h-4"}) => <svg width="16" height="16" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
    </svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
const CheckMarkIcon = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const setIn = (obj: any, path: (string | number)[], value: any): any => {
    const newObj = JSON.parse(JSON.stringify(obj));
    let current = newObj;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (current[key] === undefined) {
            current[key] = typeof path[i + 1] === 'number' ? [] : {};
        }
        current = current[key];
    }
    current[path[path.length - 1]] = value;
    return newObj;
};

const deleteIn = (obj: any, path: (string | number)[]): any => {
    const newObj = JSON.parse(JSON.stringify(obj));
    let current = newObj;
    for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
    }
    const finalKey = path[path.length - 1];
    if (Array.isArray(current) && typeof finalKey === 'number') {
        current.splice(finalKey, 1);
    } else {
        delete current[finalKey];
    }
    return newObj;
};


const getChannelIcon = (channel: 'Channels' | Channel | 'Bing', size: 'sm' | 'md' = 'sm'): React.ReactNode => {
    const dimension = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    switch (channel) {
        case 'Google':
            return <GoogleIcon className={dimension} />;
        case 'Meta':
            return <MetaIcon className={`${dimension} text-[#0866FF]`} />;
        case 'TikTok':
            return <TiktokIcon className={`${dimension} text-black`} />;
        case 'Bing':
            return <BingIcon className={`${dimension} text-[#008373]`} />;
        case 'Channels':
        default:
            return <SparklesIcon className={`${dimension} text-gray-500`} />;
    }
};

const channelOptions: Array<Channel | 'Bing'> = ['Google', 'Meta', 'TikTok', 'Bing'];

const PROMPT_EXAMPLES: string[] = [
    'Create a Google Ads Performance Max campaign for a luxury hotel in Dubai targeting English and Arabic speakers with summer offers.',
    'Plan a Google Ads Remarketing campaign for a boutique resort in Paris aimed at past guests with limited-time winter packages.',
    'Launch a Google Ads Brand campaign for a beachfront resort in Bali focusing on family-friendly amenities and school holiday travel.',
];

// ===== UI COMPONENTS =====

const Header = ({ topTab, setTopTab }: { topTab: 'campaign'|'creative', setTopTab: (t: 'campaign'|'creative') => void }) => (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 p-4 border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <img src="https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2F1003138594934a01b42521ec1d693a8d" alt="Logo" className="h-8 w-auto object-contain" />
                <div className="text-xs text-gray-500">AI Campaign generator</div>
            </div>
            <nav className="flex gap-2">
                <button onClick={()=> setTopTab('campaign')} className={`px-3 py-2 text-sm rounded-t-md ${topTab==='campaign' ? 'bg-white border border-gray-200 border-b-transparent' : 'text-gray-600 hover:text-gray-900'}`}>AI Campaign generator</button>
                <button onClick={()=> setTopTab('creative')} className={`px-3 py-2 text-sm rounded-t-md ${topTab==='creative' ? 'bg-white border border-gray-200 border-b-transparent' : 'text-gray-600 hover:text-gray-900'}`}>AI Creative generator</button>
            </nav>
        </div>
    </header>
);

const IconButton = ({ onClick, icon, children, className = "" }: { onClick: () => void, icon: React.ReactNode, children?: React.ReactNode, className?: string }) => (
    <button onClick={onClick} className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${className}`}>
        {icon}
        {children && <span>{children}</span>}
    </button>
);

const EditableField = ({ value, onSave, onGenerate, onRewrite, fieldType }: { value: string, onSave: (newValue: string) => void, onGenerate?: () => Promise<void>, onRewrite?: () => Promise<void>, fieldType?: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const [isGenerating, setIsGenerating] = useState(false);
    useEffect(() => { setCurrentValue(value); }, [value]);

    const handleSave = () => {
        onSave(currentValue);
        setIsEditing(false);
    };

    const handleGenerate = async (genFn?: () => Promise<void>) => {
        if (!genFn) return;
        setIsGenerating(true);
        try {
            await genFn();
        } catch (error) {
            console.error(`Error generating ${fieldType}`, error);
        } finally {
            setIsGenerating(false);
        }
    };
    
    if (fieldType === 'url') {
        return (
            <div className="w-full">
                <label className="block text-xs text-gray-600 mb-1">Final URL</label>
                <input
                    type="url"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    placeholder="https://example.com"
                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-1"
                    autoFocus
                />
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="flex items-center w-full">
                <input
                    type="text"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    className="flex-grow bg-white border border-blue-500 rounded-md px-2 py-1 text-sm shadow-sm"
                    autoFocus
                />
            </div>
        );
    }

    return (
        <div className="group flex items-center justify-between w-full py-1">
            <span className="text-sm text-gray-700">{value}</span>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onGenerate && <IconButton onClick={() => handleGenerate(onGenerate)} icon={isGenerating ? <SpinnerIcon className="w-3 h-3 text-gray-500" /> : <SparklesIcon className="w-3 h-3" />} className="text-gray-500 hover:bg-gray-200" />}
                {onRewrite && <IconButton onClick={() => handleGenerate(onRewrite)} icon={isGenerating ? <SpinnerIcon className="w-3 h-3 text-gray-500" /> : <EditIcon className="w-3 h-3" />} className="text-gray-500 hover:bg-gray-200" />}
                <IconButton onClick={() => setIsEditing(true)} icon={<EditIcon className="w-3 h-3" />} className="text-gray-500 hover:bg-gray-200" />
            </div>
        </div>
    );
};


const EditableList = ({ title, items, onUpdate, onAdd, onDelete, onGenerate, onRewrite, assetType }: { title: string, items: string[], onUpdate: (index: number, value: string) => void, onAdd: (value: string) => void, onDelete: (index: number) => void, onGenerate: (existing: string[]) => Promise<string>, onRewrite: (existing: string[], toRewrite: string) => Promise<string>, assetType: AssetType }) => {
    const [isGeneratingNew, setIsGeneratingNew] = useState(false);
    
    const handleGenerateNew = async () => {
        setIsGeneratingNew(true);
        try {
            const newItem = await onGenerate(items);
            onAdd(newItem);
        } catch (error) {
            console.error(`Error generating new ${assetType}:`, error);
        } finally {
            setIsGeneratingNew(false);
        }
    };

    const handleRewriteItem = (index: number) => async () => {
        const toRewrite = items[index];
        const newItem = await onRewrite(items, toRewrite);
        onUpdate(index, newItem);
    };

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-600 mb-1">{title}</h4>
            <ul className="space-y-1">
                {items.map((item, index) => (
                    <li key={index} className="flex items-center space-x-2 group bg-gray-50 p-1 rounded-md">
                        <EditableField value={item} onSave={(newValue) => onUpdate(index, newValue)} onRewrite={handleRewriteItem(index)} fieldType={assetType} />
                        <IconButton onClick={() => onDelete(index)} icon={<TrashIcon className="w-3 h-3" />} className="text-red-500 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </li>
                ))}
            </ul>
            <IconButton onClick={handleGenerateNew} icon={isGeneratingNew ? <SpinnerIcon className="w-4 h-4 text-gray-500" /> : <PlusIcon />} className="mt-2 text-gray-600 hover:bg-gray-200 w-full justify-start">
                Add {assetType}
            </IconButton>
        </div>
    );
};

const UploadSection = ({ label, hint, accept, max, items, onAddFiles, onRemove, onChooseFromLibrary, onOpenGenerator, onChooseBanner }: { label: string; hint: string; accept: string; max: number; items: string[]; onAddFiles: (files: FileList) => void; onRemove: (index: number) => void; onChooseFromLibrary?: () => void; onOpenGenerator?: () => void; onChooseBanner?: () => void; }) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const remaining = Math.max(0, max - (items?.length || 0));
    return (
        <div className="py-3 border-t border-gray-100">
            <div className="text-sm font-medium text-gray-800">{label}</div>
            <div className="text-xs text-gray-500 mb-2">{hint}</div>
            <div className="flex items-center gap-3 flex-wrap">
                {items?.map((src, i) => (
                    <div key={i} className="relative">
                        <img src={src} alt={`${label} ${i+1}`} className="w-16 h-16 object-cover rounded-md border" />
                        <button aria-label={`Remove ${label} ${i+1}`} onClick={() => onRemove(i)} className="absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6 flex items-center justify-center text-red-500 hover:bg-red-50">��</button>
                    </div>
                ))}
                <input ref={inputRef} className="hidden" type="file" accept={accept} multiple onChange={(e) => { if(e.target.files) { onAddFiles(e.target.files); e.currentTarget.value = ''; } }} />
                {remaining > 0 && (
                    <button onClick={() => inputRef.current?.click()} className="text-blue-600 text-sm font-semibold flex items-center gap-1">
                        <span className="text-base leading-none">＋</span>
                        <span>{label.toUpperCase()}</span>
                    </button>
                )}
                {onChooseFromLibrary && (
                    <button onClick={onChooseFromLibrary} className="text-xs px-2 py-1 rounded-md border">Use library</button>
                )}
                {onOpenGenerator && accept.startsWith('image') && (
                    <button onClick={onOpenGenerator} className="text-xs px-2 py-1 rounded-md border">Open generator</button>
                )}
                {onChooseBanner && accept.startsWith('image') && (
                    <button onClick={onChooseBanner} className="text-xs px-2 py-1 rounded-md border">Use banner</button>
                )}
            </div>
        </div>
    );
};

const FieldSection = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
    <div className="py-3 border-t border-gray-100">
        <div className="text-sm font-medium text-gray-800">{title}</div>
        <div className="text-xs text-gray-500 mb-2">{hint}</div>
        {children}
    </div>
);

const AssignPillsPicker = ({ value, onChange, planCombos }: { value: Array<{ source: 'plan' | 'external'; adGroupId?: string; campaignName?: string; adGroupName?: string }>; onChange: (v: any[]) => void; planCombos: { campaignId:string; campaignName:string; adGroupId:string; adGroupName:string }[]; }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => { const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc); }, []);

    const mockExisting = [
        { campaignName: '[UG]-Brand-USA', adGroups: ['Brand Exact', 'Brand Phrase'] },
        { campaignName: '[UG]-Remarketing-ALL', adGroups: ['All Visitors 30d', 'Cart Abandoners 14d'] },
        { campaignName: '[UG]-Hotel-EN', adGroups: ['Hotel Brand EN', 'Generic Hotel EN'] },
        { campaignName: '[UG]-PMax-Core', adGroups: ['Asset Group A', 'Asset Group B'] },
    ];

    const isSelectedPlan = (id: string) => value?.some(v => v.source==='plan' && v.adGroupId===id);
    const togglePlan = (id: string) => {
        const set = new Set(value?.filter(Boolean).map(v => JSON.stringify(v)));
        const key = JSON.stringify({ source:'plan', adGroupId:id });
        if (set.has(key)) set.delete(key); else set.add(key);
        onChange(Array.from(set).map(s => JSON.parse(s as string)));
    };

    const isSelectedExt = (cName: string, gName: string) => value?.some(v => v.source==='external' && v.campaignName===cName && v.adGroupName===gName);
    const toggleExt = (cName: string, gName: string) => {
        const set = new Set(value?.filter(Boolean).map(v => JSON.stringify(v)));
        const key = JSON.stringify({ source:'external', campaignName:cName, adGroupName:gName });
        if (set.has(key)) set.delete(key); else set.add(key);
        onChange(Array.from(set).map(s => JSON.parse(s as string)));
    };

    return (
        <div className="flex items-center gap-2 flex-wrap" ref={ref}>
            {(value || []).map((v, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs">
                    {v.source==='plan' ? 'Plan' : 'Existing'} {v.source==='plan' ? (planCombos.find(p=>p.adGroupId===v.adGroupId)?.adGroupName || '') : (v.adGroupName || '')}
                    <button onClick={() => { v.source==='plan' ? togglePlan(v.adGroupId!) : toggleExt(v.campaignName!, v.adGroupName!); }} className="text-gray-500 hover:text-black">×</button>
                </span>
            ))}
            <div className="relative">
                <button onClick={() => setOpen(o=>!o)} className="px-2 py-1.5 text-xs rounded-md border">Assign</button>
                {open && (
                    <div className="absolute z-20 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                        <div className="text-[11px] text-gray-500 px-1 py-1">Current plan</div>
                        <div className="max-h-40 overflow-auto">
                            {planCombos.map(p => (
                                <label key={p.adGroupId} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                    <input type="checkbox" className="h-3.5 w-3.5" checked={isSelectedPlan(p.adGroupId)} onChange={()=>togglePlan(p.adGroupId)} />
                                    <span className="truncate">{p.campaignName} ��� {p.adGroupName}</span>
                                </label>
                            ))}
                        </div>
                        <div className="text-[11px] text-gray-500 px-1 py-1 border-t mt-1">Existing</div>
                        <div className="max-h-40 overflow-auto">
                            {mockExisting.map(ex => (
                                <div key={ex.campaignName} className="px-1 py-1">
                                    <div className="text-[11px] text-gray-500 px-1">{ex.campaignName}</div>
                                    {ex.adGroups.map(g => (
                                        <label key={g} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
                                            <input type="checkbox" className="h-3.5 w-3.5" checked={isSelectedExt(ex.campaignName, g)} onChange={()=>toggleExt(ex.campaignName, g)} />
                                            <span className="truncate">{g}</span>
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CollapsibleCard = ({ title, onUpdateTitle, onDelete, children }: { title: string, onUpdateTitle: (newTitle: string) => void, onDelete: () => void, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="border-t border-b border-gray-200">
            <div className={`flex items-center justify-between px-4 py-3 ${isOpen ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <div className="flex-grow mr-3">
                    <EditableField value={title} onSave={onUpdateTitle} />
                </div>
                <div className="flex items-center space-x-1.5">
                    <IconButton onClick={onDelete} icon={<TrashIcon />} className="text-red-500 hover:bg-red-100" />
                    <IconButton onClick={() => setIsOpen(!isOpen)} icon={<ChevronDownIcon className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />} className="text-gray-500 hover:bg-gray-200" />
                </div>
            </div>
            {isOpen && <div className="px-4 pb-3 space-y-3">{children}</div>}
        </div>
    );
};

// ===== Preview Component =====
const CampaignPreview = ({ campaign }: { campaign: FullCampaign }) => {
    const isPMax = campaign.channel === 'Google' && (/pmax|performance\s*max|hotel/i.test(campaign.campaignType));
    const isSearchLike = campaign.channel === 'Google' && (/brand|search/i.test(campaign.campaignType));
    const google = campaign.googleAds;

    const ads: any[] = ((google as any)?.ads || []);
    const ags: any[] = (google?.assetGroups || []);

    const [index, setIndex] = React.useState(0);
    useEffect(() => { setIndex(0); }, [campaign.id]);

    const total = isPMax ? Math.max(1, ags.length) : Math.max(1, ads.length);
    const prev = () => setIndex(i => (i - 1 + total) % total);
    const next = () => setIndex(i => (i + 1) % total);

    const activeAd = !isPMax ? ads[index] || ads[0] : null;
    const activeAg = isPMax ? ags[index] || ags[0] : null;

    const urlHost = (() => {
        const url = (activeAd?.finalUrl || activeAg?.finalUrl || '').trim();
        try { return url ? new URL(url).host + (new URL(url).pathname.replace(/\/$/, '')) : campaign.market?.name?.toLowerCase().replace(/\s+/g,'') + '.example.com'; } catch { return url || 'example.com'; }
    })();

    const ICONS = {
        youtube: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2Ffbae06c51cba4bbea5cd052e5783c200?format=webp&width=64',
        gmail: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2Fdb918b8748404fcb953edc0cb74f09bd?format=webp&width=64',
        search: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2F8f9ab081ad3348488441612a62167de8?format=webp&width=64',
        feed: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2Fe105de11ebfb46e1a1bb055962787132?format=webp&width=64',
        display: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2F38ac8ca1583a4c4588674017cd5d7a67?format=webp&width=64',
    } as const;

    const Tabs = () => {
        if (isSearchLike) {
            return (
                <div className="p-3 border-b border-gray-100 flex items-center justify-center gap-4 text-xs text-gray-600" role="tablist" aria-label="Preview surfaces">
                    <div className="flex flex-col items-center gap-1 border-b-2 border-gray-800 pb-1" role="tab" aria-selected="true"><img className="h-5 w-auto" src={ICONS.search} width="20" height="20" decoding="async" alt="Search"/><span>Search</span></div>
                </div>
            );
        }
        // PMax / Hotel → show all
        return (
            <div className="p-3 border-b border-gray-100 flex items-center justify-around text-xs text-gray-600" role="tablist" aria-label="Preview surfaces">
                <div className="flex flex-col items-center gap-1" role="tab" aria-selected="false"><img className="h-5 w-auto" src={ICONS.youtube} width="20" height="20" decoding="async" alt="YouTube"/><span>YouTube</span></div>
                <div className="flex flex-col items-center gap-1" role="tab" aria-selected="false"><img className="h-5 w-auto" src={ICONS.gmail} width="20" height="20" decoding="async" alt="Gmail"/><span>Gmail</span></div>
                <div className="flex flex-col items-center gap-1 border-b-2 border-gray-800 pb-1" role="tab" aria-selected="true"><img className="h-5 w-auto" src={ICONS.search} width="20" height="20" decoding="async" alt="Search"/><span>Search</span></div>
                <div className="flex flex-col items-center gap-1" role="tab" aria-selected="false"><img className="h-5 w-auto" src={ICONS.feed} width="20" height="20" decoding="async" alt="Feed"/><span>Feed</span></div>
                <div className="flex flex-col items-center gap-1" role="tab" aria-selected="false"><img className="h-5 w-auto" src={ICONS.display} width="20" height="20" decoding="async" alt="Display"/><span>Display</span></div>
            </div>
        );
    };

    return (
        <div className="bg-white relative" role="region" aria-label="Ad preview">
            <Tabs />
            <div className="p-6 relative" aria-live="polite">
                <button aria-label="Previous variation" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg></button>
                <button aria-label="Next variation" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 border border-gray-200 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 6 15 12 9 18"/></svg></button>
                <div className="mx-auto max-w-md rounded-xl border border-gray-200 p-4 bg-white">
                    <div className="text-[11px] text-gray-500 mb-1">Ad · {urlHost}</div>
                    <div className="text-[#1a0dab] text-[15px] font-medium leading-snug">
                        {isSearchLike ? (
                            <>
                                {(activeAd?.headlines?.[0] || activeAg?.headlines?.[0] || 'Your headline here')}
                                {(activeAd?.headlines?.[1] || activeAg?.headlines?.[1]) ? ' | ' + (activeAd?.headlines?.[1] || activeAg?.headlines?.[1]) : ''}
                            </>
                        ) : (activeAg?.headlines?.[0] || activeAd?.headlines?.[0] || 'Performance Max preview')}
                    </div>
                    <div className="text-[12px] text-gray-700 mt-1">
                        {(activeAd?.descriptions?.[0] || activeAg?.descriptions?.[0] || 'Preview of your ad copy will appear here based on your generated assets.')}
                    </div>
                    <div className="mt-3 space-y-2">
                        <div className="h-6 bg-gray-100 rounded-md" />
                        <div className="h-6 bg-gray-100 rounded-md" />
                    </div>
                    {total > 1 && (
                        <div className="mt-3 text-center text-[11px] text-gray-500">Variation {index + 1} of {total}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ===== Channel-Specific Detail Components =====

const GoogleCampaignDetails = ({ campaign, allCampaigns, brief, onUpdate, onAdd, onDelete, onGenerate, onRewrite, onPickFromLibrary, onOpenGenerator, onPickBanner }: { campaign: FullCampaign, allCampaigns: FullCampaign[], brief: string, onUpdate: (path: (string | number)[], value: any) => void, onAdd: (path: (string | number)[], value: any) => void, onDelete: (path: (string | number)[]) => void, onGenerate: (assetType: AssetType, existing: string[]) => Promise<string>, onRewrite: (assetType: AssetType, existing: string[], toRewrite: string) => Promise<string>, onPickFromLibrary: (type: 'images'|'logos', max: number, onSelect: (urls: string[]) => void) => void, onOpenGenerator: () => void, onPickBanner: (onSelect: (preset: BannerPreset) => void) => void }) => {
    const { googleAds } = campaign;
    if (!googleAds) return null;

    const [creatingGroup, setCreatingGroup] = useState(false);
    const [creatingAd, setCreatingAd] = useState(false);
    const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
    const [expandedAssetGroupId, setExpandedAssetGroupId] = useState<string | null>(null);
    const isPMax = /pmax|performance\s*max|hotel/i.test(campaign.campaignType);
    const [budget, setBudget] = useState((campaign as any).budget || '500');
    const [selectedMarkets, setSelectedMarkets] = useState<Market[]>([campaign.market]);

    const currentPlanCombos = useMemo(() => {
        const combos: { campaignId:string; campaignName:string; adGroupId:string; adGroupName:string }[] = [];
        (allCampaigns || []).forEach(c => {
            if (c.channel !== 'Google') return;
            const groups = c.googleAds?.adGroups || [];
            groups.forEach(g => combos.push({ campaignId: c.id, campaignName: c.campaignName, adGroupId: g.id, adGroupName: g.name }));
        });
        return combos;
    }, [allCampaigns]);

    const addAdGroup = async () => {
        setCreatingGroup(true);
        try {
            const group = await generateGoogleAdGroup(brief, campaign);
            onAdd(['googleAds', 'adGroups'], group);
        } finally { setCreatingGroup(false); }
    };

    return (
        <div className="space-y-4">
            {googleAds.assetGroups && googleAds.assetGroups.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2">
                    <h3 className="text-sm font-semibold text-gray-700">Asset Groups (PMax)</h3>
                </div>
            )}
            {googleAds.assetGroups?.map((ag, agIndex) => (
                <CollapsibleCard
                    key={ag.id}
                    title={ag.name}
                    onUpdateTitle={(newTitle) => onUpdate(['googleAds', 'assetGroups', agIndex, 'name'], newTitle)}
                    onDelete={() => onDelete(['googleAds', 'assetGroups', agIndex])}
                >
                    <EditableField value={ag.finalUrl} onSave={(newValue) => onUpdate(['googleAds', 'assetGroups', agIndex, 'finalUrl'], newValue)} fieldType="url" />

                    <UploadSection
                        label="Images"
                        hint="Add up to 15 images"
                        accept="image/*"
                        max={15}
                        items={ag.images || []}
                        onAddFiles={(files) => {
                            const urls = Array.from(files).slice(0, 15).map(f => URL.createObjectURL(f));
                            const next = [ ...(ag.images || []), ...urls ].slice(0, 15);
                            onUpdate(['googleAds','assetGroups', agIndex, 'images'], next);
                        }}
                        onRemove={(i) => { const next = (ag.images || []).filter((_,idx)=>idx!==i); onUpdate(['googleAds','assetGroups', agIndex, 'images'], next); }}
                        onChooseFromLibrary={() => onPickFromLibrary('images', 15, (urls) => { const next = [ ...(ag.images || []), ...urls ].slice(0, 15); onUpdate(['googleAds','assetGroups', agIndex, 'images'], next); })}
                        onOpenGenerator={onOpenGenerator}
                        onChooseBanner={() => onPickBanner((preset) => {
                            const urls = (preset.images || []).slice(0, 15);
                            const next = [ ...(ag.images || []), ...urls ].slice(0, 15);
                            onUpdate(['googleAds','assetGroups', agIndex, 'images'], next);
                            if (preset.logo) {
                                const logosNext = [ ...(ag.logos || []), preset.logo ].slice(0, 5);
                                onUpdate(['googleAds','assetGroups', agIndex, 'logos'], logosNext);
                            }
                        })}
                    />

                    <UploadSection
                        label="Logos"
                        hint="Add up to 5 logos"
                        accept="image/*"
                        max={5}
                        items={ag.logos || []}
                        onAddFiles={(files) => {
                            const urls = Array.from(files).slice(0, 5).map(f => URL.createObjectURL(f));
                            const next = [ ...(ag.logos || []), ...urls ].slice(0, 5);
                            onUpdate(['googleAds','assetGroups', agIndex, 'logos'], next);
                        }}
                        onRemove={(i) => { const next = (ag.logos || []).filter((_,idx)=>idx!==i); onUpdate(['googleAds','assetGroups', agIndex, 'logos'], next); }}
                        onChooseFromLibrary={() => onPickFromLibrary('logos', 5, (urls) => { const next = [ ...(ag.logos || []), ...urls ].slice(0, 5); onUpdate(['googleAds','assetGroups', agIndex, 'logos'], next); })}
                        onOpenGenerator={onOpenGenerator}
                        onChooseBanner={() => onPickBanner((preset) => {
                            if (preset.logo) {
                                const logosNext = [ ...(ag.logos || []), preset.logo ].slice(0, 5);
                                onUpdate(['googleAds','assetGroups', agIndex, 'logos'], logosNext);
                            }
                            const urls = (preset.images || []).slice(0, 15);
                            if (urls.length) {
                                const next = [ ...(ag.images || []), ...urls ].slice(0, 15);
                                onUpdate(['googleAds','assetGroups', agIndex, 'images'], next);
                            }
                        })}
                    />

                    <UploadSection
                        label="Videos"
                        hint="Add up to 5 videos"
                        accept="video/*"
                        max={5}
                        items={ag.videos || []}
                        onAddFiles={(files) => {
                            const urls = Array.from(files).slice(0, 5).map(f => URL.createObjectURL(f));
                            const next = [ ...(ag.videos || []), ...urls ].slice(0, 5);
                            onUpdate(['googleAds','assetGroups', agIndex, 'videos'], next);
                        }}
                        onRemove={(i) => { const next = (ag.videos || []).filter((_,idx)=>idx!==i); onUpdate(['googleAds','assetGroups', agIndex, 'videos'], next); }}
                    />

                    <EditableList title="Headlines" items={ag.headlines} assetType="headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'headlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'headlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'headlines', i])} onGenerate={(e) => onGenerate('headline', e)} onRewrite={(e, r) => onRewrite('headline', e, r)} />
                    <EditableList title="Long Headlines" items={ag.longHeadlines} assetType="long headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'longHeadlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i])} onGenerate={(e) => onGenerate('long headline', e)} onRewrite={(e, r) => onRewrite('long headline', e, r)} />
                    <EditableList title="Descriptions" items={ag.descriptions} assetType="description" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'descriptions', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'descriptions'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'descriptions', i])} onGenerate={(e) => onGenerate('description', e)} onRewrite={(e, r) => onRewrite('description', e, r)} />
                </CollapsibleCard>
            ))}

            { !isPMax && (
            <>
            <div className="flex items-center justify-between px-4 py-2">
                <h3 className="text-sm font-semibold text-gray-700">Ad Groups (Search/Brand)</h3>
                <button onClick={addAdGroup} disabled={creatingGroup} className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-1">
                    {creatingGroup ? <SpinnerIcon className="w-4 h-4 text-white"/> : <PlusIcon className="w-4 h-4"/>}
                    Add Ad Group
                </button>
            </div>
            {(!googleAds.adGroups || googleAds.adGroups.length === 0) && (
                <div className="text-xs text-gray-500 mb-2">No ad groups yet — click “Add Ad Group���.</div>
            )}

            {googleAds.adGroups?.map((adg, adgIndex) => (
                <CollapsibleCard
                    key={adg.id}
                    title={adg.name}
                    onUpdateTitle={(newTitle) => onUpdate(['googleAds', 'adGroups', adgIndex, 'name'], newTitle)}
                    onDelete={() => onDelete(['googleAds', 'adGroups', adgIndex])}
                >
                    <FieldSection title="Assign to campaign" hint="Select the campaign this ad group belongs to">
                        <div className="flex items-center gap-2">
                            <select
                                value={(adg as any).assignedCampaignName || campaign.campaignName}
                                onChange={(e) => onUpdate(['googleAds','adGroups', adgIndex, 'assignedCampaignName'], e.target.value)}
                                className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
                            >
                                <option value="">Unassigned</option>
                                <option value={campaign.campaignName}>{campaign.campaignName}</option>
                            </select>
                            <div className="ml-auto text-xs text-gray-500">Assigned Ads: {(googleAds as any).ads ? ((googleAds as any).ads as any[]).filter(a => (a.assignedTargets || []).some((t:any)=> t.source==='plan' && t.adGroupId===adg.id) || a.assignedAdGroupId === adg.id).length : 0}</div>
                        </div>
                    </FieldSection>
                </CollapsibleCard>
            ))}

            <div className="flex items-center justify-between px-4 py-2">
                <h3 className="text-sm font-semibold text-gray-700">Ads</h3>
                <button
                    onClick={async () => {
                        try {
                            setCreatingAd(true);
                            const ad = await generateGoogleSearchAd(brief, campaign);
                            const firstGroupId = googleAds.adGroups?.[0]?.id || null;
                            (ad as any).assignedTargets = firstGroupId ? [{ source: 'plan', adGroupId: firstGroupId }] : [];
                            const existing: any[] = (googleAds as any).ads || [];
                            onUpdate(['googleAds', 'ads'], [ad, ...existing]);
                            setExpandedAdId(ad.id);
                        } finally {
                            setCreatingAd(false);
                        }
                    }}
                    disabled={creatingAd}
                    className="px-3 py-1.5 text-xs rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-400 flex items-center gap-2"
                >
                    {creatingAd ? <SpinnerIcon className="w-4 h-4 text-white"/> : null}
                    Create Ad
                </button>
            </div>
            {(!(googleAds as any).ads || (googleAds as any).ads.length === 0) && (
                <div className="text-xs text-gray-500 mb-2">No ads yet — click “Create Ad”.</div>
            )}

            {((googleAds as any).ads || []).map((ad: any, adIndex: number) => (
                <CollapsibleCard
                    key={ad.id}
                    title={ad.headlines?.[0] || ad.finalUrl || `Ad ${adIndex + 1}`}
                    onUpdateTitle={(newTitle) => onUpdate(['googleAds','ads', adIndex, 'headlines', 0], newTitle)}
                    onDelete={() => onDelete(['googleAds','ads', adIndex])}
                >
                    <FieldSection title="Assign" hint="Select campaigns and ad groups">
                        <AssignPillsPicker
                            value={ad.assignedTargets || []}
                            onChange={(next) => onUpdate(['googleAds','ads', adIndex, 'assignedTargets'], next)}
                            planCombos={currentPlanCombos}
                        />
                    </FieldSection>
                    {ad.assignedExternal && (
                        <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Existing Campaign Name</label>
                                <input value={ad.assignedExternal.campaignName} onChange={(e)=> onUpdate(['googleAds','ads', adIndex, 'assignedExternal', 'campaignName'], e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1" placeholder="e.g. [UG]-Brand-USA" />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Existing Ad Group Name</label>
                                <input value={ad.assignedExternal.adGroupName} onChange={(e)=> onUpdate(['googleAds','ads', adIndex, 'assignedExternal', 'adGroupName'], e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1" placeholder="e.g. Brand-Exact" />
                            </div>
                        </div>
                    )}
                    <FieldSection title="Final URL" hint="Set the destination page for this ad">
                        <EditableField value={ad.finalUrl} onSave={(newValue) => onUpdate(['googleAds', 'ads', adIndex, 'finalUrl'], newValue)} fieldType="url" />
                    </FieldSection>
                    <FieldSection title="Headlines" hint="Add up to 15 headlines">
                        <EditableList title={`Headlines (${ad.headlines?.length || 0}/15)`} items={ad.headlines} assetType="headline" onUpdate={(i, v) => onUpdate(['googleAds', 'ads', adIndex, 'headlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'ads', adIndex, 'headlines'], v)} onDelete={(i) => onDelete(['googleAds', 'ads', adIndex, 'headlines', i])} onGenerate={(e) => onGenerate('headline', e)} onRewrite={(e, r) => onRewrite('headline', e, r)} />
                    </FieldSection>
                    <FieldSection title="Descriptions" hint="Add up to 4 descriptions">
                        <EditableList title={`Descriptions (${ad.descriptions?.length || 0}/4)`} items={ad.descriptions} assetType="description" onUpdate={(i, v) => onUpdate(['googleAds', 'ads', adIndex, 'descriptions', i], v)} onAdd={(v) => onAdd(['googleAds', 'ads', adIndex, 'descriptions'], v)} onDelete={(i) => onDelete(['googleAds', 'ads', adIndex, 'descriptions', i])} onGenerate={(e) => onGenerate('description', e)} onRewrite={(e, r) => onRewrite('description', e, r)} />
                    </FieldSection>
                    <FieldSection title={`Keywords (${(ad.keywords?.length || 0)})`} hint="Add relevant search terms">
                        {(() => {
                            const kws = ad.keywords || [];
                            const updateKeywords = (arr: string[]) => onUpdate(['googleAds','ads', adIndex, 'keywords'], arr);
                            return (
                                <div>
                                    <ul className="space-y-1">
                                        {kws.map((kw: string, i: number) => (
                                            <li key={i} className="flex items-center space-x-2 group bg-gray-50 p-1 rounded-md">
                                                <EditableField value={kw} onSave={(v) => { const next = [...kws]; next[i] = v; updateKeywords(next); }} fieldType="keyword" />
                                                <IconButton onClick={() => { const next = kws.filter((_: any, idx: number)=> idx!==i); updateKeywords(next); }} icon={<TrashIcon className="w-3 h-3"/>} className="text-red-500 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </li>
                                        ))}
                                    </ul>
                                    <IconButton onClick={async () => { const newKw = await onGenerate('keyword', kws); updateKeywords([...(kws as string[]), newKw]); }} icon={<PlusIcon className="w-4 h-4"/>} className="mt-2 text-gray-600 hover:bg-gray-200 w-full justify-start">Add keyword</IconButton>
                                </div>
                            )
                        })()}
                    </FieldSection>
                </CollapsibleCard>
            ))}
            </>) }
        </div>
    );
};

const MetaCampaignDetails = ({ campaign, brief, onUpdate, onAdd, onDelete, onGenerate, onRewrite }: { campaign: FullCampaign, brief: string, onUpdate: (path: (string | number)[], value: any) => void, onAdd: (path: (string | number)[], value: any) => void, onDelete: (path: (string | number)[]) => void, onGenerate: (assetType: AssetType, existing: string[]) => Promise<string>, onRewrite: (assetType: AssetType, existing: string[], toRewrite: string) => Promise<string> }) => {
    const { meta } = campaign;
    if (!meta) return null;

    return (
        <>
            {meta.adSets.map((as, asIndex) => (
                <CollapsibleCard
                    key={as.id}
                    title={as.name}
                    onUpdateTitle={(newTitle) => onUpdate(['meta', 'adSets', asIndex, 'name'], newTitle)}
                    onDelete={() => onDelete(['meta', 'adSets', asIndex])}
                >
                    {as.ads.map((ad, adIndex) => (
                        <div key={ad.id} className="border-t border-gray-200 mt-4 pt-4 first:mt-0 first:pt-0 first:border-0 space-y-2">
                             <h4 className="text-sm font-semibold text-gray-600">Ad Creative</h4>
                             <div className="pl-2 border-l-2 border-gray-200 space-y-1">
                                <EditableField value={ad.primaryText} onSave={(newValue) => onUpdate(['meta', 'adSets', asIndex, 'ads', adIndex, 'primaryText'], newValue)} onRewrite={() => onRewrite('primary text', [], ad.primaryText).then(v => onUpdate(['meta', 'adSets', asIndex, 'ads', adIndex, 'primaryText'], v))} />
                                <EditableField value={ad.headline} onSave={(newValue) => onUpdate(['meta', 'adSets', asIndex, 'ads', adIndex, 'headline'], newValue)} onRewrite={() => onRewrite('meta headline', [], ad.headline).then(v => onUpdate(['meta', 'adSets', asIndex, 'ads', adIndex, 'headline'], v))} />
                                <EditableField value={ad.description} onSave={(newValue) => onUpdate(['meta', 'adSets', asIndex, 'ads', adIndex, 'description'], newValue)} onRewrite={() => onRewrite('meta description', [], ad.description).then(v => onUpdate(['meta', 'adSets', asIndex, 'ads', adIndex, 'description'], v))} />
                             </div>
                        </div>
                    ))}
                </CollapsibleCard>
            ))}
        </>
    );
};

const TikTokCampaignDetails = ({ campaign, brief, onUpdate, onAdd, onDelete, onGenerate, onRewrite }: { campaign: FullCampaign, brief: string, onUpdate: (path: (string | number)[], value: any) => void, onAdd: (path: (string | number)[], value: any) => void, onDelete: (path: (string | number)[]) => void, onGenerate: (assetType: AssetType, existing: string[]) => Promise<string>, onRewrite: (assetType: AssetType, existing: string[], toRewrite: string) => Promise<string> }) => {
    const { tikTok } = campaign;
    if (!tikTok) return null;

    return (
        <>
            {tikTok.adGroups.map((adg, adgIndex) => (
                <CollapsibleCard
                    key={adg.id}
                    title={adg.name}
                    onUpdateTitle={(newTitle) => onUpdate(['tikTok', 'adGroups', adgIndex, 'name'], newTitle)}
                    onDelete={() => onDelete(['tikTok', 'adGroups', adgIndex])}
                >
                    {adg.ads.map((ad, adIndex) => (
                         <div key={ad.id} className="border-t border-gray-200 mt-4 pt-4 first:mt-0 first:pt-0 first:border-0 space-y-2">
                             <h4 className="text-sm font-semibold text-gray-600">Ad Text</h4>
                             <EditableField value={ad.adText} onSave={(newValue) => onUpdate(['tikTok', 'adGroups', adgIndex, 'ads', adIndex, 'adText'], newValue)} onRewrite={() => onRewrite('ad text', [], ad.adText).then(v => onUpdate(['tikTok', 'adGroups', adgIndex, 'ads', adIndex, 'adText'], v))} />
                        </div>
                    ))}
                </CollapsibleCard>
            ))}
        </>
    );
};


// ===== VIEWS =====
const ChannelButton = ({ channel, icon, selected, onClick }: { channel: Channel, icon: React.ReactNode, selected: boolean, onClick: (channel: Channel) => void }) => {
    const baseClasses = "flex items-center space-x-2 px-4 py-2 rounded-lg border-2 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2";
    const selectedClasses = "bg-blue-50 border-blue-500 text-blue-700";
    const unselectedClasses = "bg-white border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800";
    
    return (
        <button onClick={() => onClick(channel)} className={`${baseClasses} ${selected ? selectedClasses : unselectedClasses}`}>
            {icon}
            <span>{channel === 'Google' ? 'Google Ads' : (channel === 'Meta' ? 'Meta Ads' : 'Tiktok Ads')}</span>
        </button>
    )
}

const MarketSelector = ({ label, selectedMarkets, onAdd, onRemove, allSelectedMarkets, onClear }: { label: string, selectedMarkets: Market[], onAdd: (market: Market) => void, onRemove: (market: Market) => void, allSelectedMarkets: Market[], onClear?: () => void }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredCountries = useMemo(() => {
        return COUNTRIES.filter(c =>
            c.name.toLowerCase().includes(query.toLowerCase()) &&
            !allSelectedMarkets.some(sm => sm.iso === c.iso)
        );
    }, [query, allSelectedMarkets]);

    const handleSelect = (country: Omit<Market, 'browserLangs'>) => {
        onAdd(getMarketWithLangs(country));
        setQuery('');
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={containerRef}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                {onClear && selectedMarkets.length > 0 && (
                    <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700">Clear</button>
                )}
            </div>
            <div className="relative mt-1">
                <div className="w-full p-2 border border-gray-200 rounded-lg flex flex-wrap gap-2 min-h-[42px]">
                    {selectedMarkets.map(market => (
                        <span key={market.iso} className="flex items-center bg-gray-100 text-gray-700 text-sm font-medium px-2.5 py-1 rounded-full">
                            {market.name}
                            <button onClick={() => onRemove(market)} className="ml-1.5 text-gray-400 hover:text-gray-600">
                                &times;
                            </button>
                        </span>
                    ))}
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && filteredCountries[0]) handleSelect(filteredCountries[0]);
                            if (e.key === 'Escape') setIsOpen(false);
                        }}
                        placeholder="Search for a country..."
                        className="flex-grow p-0 border-none focus:ring-0"
                    />
                </div>
                {isOpen && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {filteredCountries.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-gray-500">No countries match "{query}"</li>
                        ) : (
                            filteredCountries.map(c => (
                                <li key={c.iso} onClick={() => handleSelect(c)} className="px-4 py-2 cursor-pointer hover:bg-gray-100">
                                    {c.name}
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
};

const MultiSelectDropdown = ({ label, options, selectedOptions, onToggle, placeholder = 'Select options...', searchPlaceholder = 'Search options' }: { label: string, options: string[], selectedOptions: string[], onToggle: (option: string) => void, placeholder?: string, searchPlaceholder?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return options.filter(option => option.toLowerCase().includes(q));
    }, [options, query]);

    const visibleSelected = selectedOptions.slice(0, 2);
    const extraCount = Math.max(0, selectedOptions.length - visibleSelected.length);

    return (
        <div ref={containerRef} className="campaign-multi-select max-w-md w-full">
            <label className="campaign-multi-select__label text-[11px] font-semibold uppercase tracking-wide text-gray-600">{label}</label>
            <div className="relative mt-1">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="campaign-multi-select__trigger w-full h-10 rounded-lg border border-gray-200 px-3 flex items-center justify-between bg-white text-left text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                >
                    <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                        {selectedOptions.length > 0 ? (
                            <>
                                {visibleSelected.map(option => (
                                    <span key={option} className="campaign-multi-select__chip bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                        {option}
                                    </span>
                                ))}
                                {extraCount > 0 && (
                                    <span className="campaign-multi-select__chip bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">+{extraCount}</span>
                                )}
                            </>
                        ) : (
                            <span className="text-gray-500">{placeholder}</span>
                        )}
                    </div>
                    <ChevronDownIcon className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="campaign-multi-select__panel absolute z-[1300] mt-2 w-full sm:w-80 rounded-lg border border-gray-200 bg-white shadow-xl">
                        <div className="border-b border-gray-100 p-2">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div className="max-h-52 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {filtered.length === 0 ? (
                                <div className="col-span-2 px-2 py-1.5 text-xs text-gray-500">No matches</div>
                            ) : (
                                filtered.map(option => {
                                    const active = selectedOptions.includes(option);
                                    return (
                                        <button
                                            type="button"
                                            key={option}
                                            onClick={() => onToggle(option)}
                                            className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-sm transition-colors ${active ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            <span className="truncate">{option}</span>
                                            {active && (
                                                <svg className="w-4 h-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        <div className="flex items-center gap-2 border-t border-gray-100 p-2">
                            <button
                                type="button"
                                onClick={() => options.forEach(option => {
                                    if (!selectedOptions.includes(option)) onToggle(option);
                                })}
                                className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200"
                            >
                                Select all
                            </button>
                            <button
                                type="button"
                                onClick={() => selectedOptions.forEach(option => onToggle(option))}
                                className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                                Clear
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="ml-auto text-xs px-2 py-1 rounded-full bg-black text-white hover:bg-gray-800"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ===== Guided Prompt =====
type GuidedPromptRequirement = {
    id: string;
    label: string;
    instruction: string;
    detect: (text: string) => boolean;
    suggestions?: string[];
    format?: (choice: string) => string;
};

const GuidedPrompt = ({ value, onChange, schema, placeholder }: { value: string; onChange: (text: string) => void; schema: GuidedPromptRequirement[]; placeholder?: string; }) => {
    const status = useMemo(() => schema.map(req => ({ id: req.id, label: req.label, done: req.detect(value) })), [schema, value]);
    const missing = useMemo(() => status.filter(s => !s.done).map(s => schema.find(r => r.id === s.id)!).filter(Boolean), [status, schema]);

    const has = useCallback((id: string) => {
        const req = schema.find(r => r.id === id);
        return req ? req.detect(value) : false;
    }, [schema, value]);

    const topText = useMemo(() => {
        const raw = (value || '').trim();
        if (missing.length === 0) return "Looks great! Any extra details about the hotel or creative angle will help us craft even better campaigns — but this is enough to kick things off.";
        if (raw.length === 0 || missing.length === schema.length) {
            return 'Tell us more about your campaign. Start anywhere — markets, campaign type, hotel details, or creative angle — I\'ll guide you.';
        }
        const mkt = has('market');
        const typ = has('type');
        if (!mkt && typ) return 'Nice direction! Which markets do you want to target?';
        if (mkt && !typ) return 'That\'s cool! Now, which campaign type do you want to create? (PMax, Brand, Remarketing, Hotel Ads).';
        if (mkt && typ && !has('hotel')) return 'Awesome! Tell me about the hotel — name, location, star rating, and what makes it special.';
        if (!has('angle')) return 'Great! Any angle or creative direction? Seasonal, luxury, family, deals, etc.';
        return 'You\'re doing great — add any extra details you think matter, or proceed when ready.';
    }, [value, missing, schema, has]);

    return (
        <div>
            <div className="mb-2 text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-700">
                {topText}
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-20 p-3 border-0 rounded-lg outline-none focus:outline-none focus:ring-0 resize-none text-gray-800 placeholder-gray-500 text-base"
                placeholder={placeholder || 'Enter a task'}
            />
        </div>
    );
};

// ===== Markets data and helpers =====
const MARKETS = WORLD_COUNTRIES;
const findMarket = (c: string) => MARKETS.find(m => m.code === c);
const LANGUAGE_LIST: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'ja', name: 'Japanese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' }
];
const langNameFromCode = (code: string) => LANGUAGE_LIST.find(l => l.code === code)?.name || code;
const langCodeFromName = (name: string) => LANGUAGE_LIST.find(l => l.name === name)?.code || name;
const suggestClusterName = (codes: string[]) => {
  const names = codes.map(c => findMarket(c)?.name || c);
  if (names.length <= 3) return names.join(" · ");
  return `${names[0]} +${names.length - 1}`;
};
const mergeLanguageLists = (...lists: (string[] | undefined)[]): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  lists.flat().forEach(value => {
    const normalized = value?.trim();
    if (!normalized) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
};
const createClusterMarket = (codes: string[]): Market | null => {
  const uniqueCodes = Array.from(new Set(codes.map(code => code.trim().toUpperCase()).filter(Boolean)));
  if (uniqueCodes.length < 2) return null;
  const markets = uniqueCodes.map(code => {
    const baseName = findMarket(code)?.name || code;
    return getMarketWithLangs({ name: baseName, iso: code } as Omit<Market, 'browserLangs'>);
  });
  const name = suggestClusterName(uniqueCodes);
  const browserLangs = mergeLanguageLists(...markets.map(m => m.browserLangs));
  const iso = uniqueCodes.join('+');
  return { name, iso, browserLangs };
};
const getCountryFlag = (isoCode: string): string => {
  if (!isoCode || isoCode === 'WW') return '🌍';
  const code = isoCode.toUpperCase();
  if (code.length !== 2) return '🌍';
  const codePoints = [...code].map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};
const dedupeCodes = (codes: string[], assignedSet: Set<string>) => Array.from(new Set(codes)).filter(c => !assignedSet.has(c));
const actionsForSelection = (picked: string[], assignedSet: Set<string>) => {
  const count = picked.length;
  const anyNew = picked.some(c => !assignedSet.has(c));
  return {
    showAddMarket: count === 1 && anyNew,
    showAddMarkets: count >= 2 && anyNew,
    showAddCluster: count >= 2 && anyNew,
  };
};

const CAMPAIGN_TYPE_ALIASES: Record<string, string> = {
  'performance max': 'PMax',
  'performance-max': 'PMax',
  'performance marketing max': 'PMax',
  'remarketing': 'Retargeting',
  'retargeting': 'Retargeting',
  'hotel campaign': 'Hotel Ads',
  'hotel ad': 'Hotel Ads',
  'branding': 'Brand',
  'brand campaign': 'Brand'
};

const canonicalizeCampaignType = (value: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (CAMPAIGN_TYPE_ALIASES[lower]) return CAMPAIGN_TYPE_ALIASES[lower] as string;
  const exact = ALL_CAMPAIGN_TYPES.find(type => type.toLowerCase() === lower);
  if (exact) return exact;
  return trimmed
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const normalizeAiMarket = (raw: Partial<Market> | null | undefined): Market | null => {
  if (!raw) return null;
  const rawIso = (raw.iso || '').toString().trim();
  let iso = rawIso ? rawIso.toUpperCase() : '';
  if (!iso && raw.name) {
    const byName = MARKETS.find(m => m.name.toLowerCase() === raw.name!.toLowerCase());
    if (byName) iso = byName.code;
  }
  const base = iso ? findMarket(iso) : undefined;
  if (!iso && base) iso = base.code;
  if (!iso) return null;
  const name = (raw.name || base?.name || iso).toString();
  const marketWithLangs = getMarketWithLangs({ name, iso });
  const langSet = new Set<string>(marketWithLangs.browserLangs);
  if (Array.isArray(raw.browserLangs)) {
    raw.browserLangs.forEach(lang => {
      if (typeof lang === 'string' && lang.trim()) {
        langSet.add(lang.trim());
      }
    });
  }
  return { ...marketWithLangs, name, browserLangs: Array.from(langSet) };
};

type MarketItem = { type: 'single' | 'cluster'; name: string; codes: string[] };

type InputViewProps = {
    onGenerate: (prompt: string, channels: Channel[], manualParams?: ManualCampaignConfig, accountId?: string) => void;
    googleAccounts: GoogleAdAccount[];
    selectedAccountId: string;
    onSelectAccount: (id: string) => void;
};

const InputView = ({ onGenerate, googleAccounts, selectedAccountId, onSelectAccount }: InputViewProps) => {
    const [brief, setBrief] = useState("");
    const [selectedChannels, setSelectedChannels] = useState<Channel[]>([]);
    const [showMarkets, setShowMarkets] = useState(false);
    const [selectedCampaignTypes, setSelectedCampaignTypes] = useState<string[]>([]);
    const [channelMenuOpen, setChannelMenuOpen] = useState(false);
    const [isParsingPrompt, setIsParsingPrompt] = useState(false);
    const [channelMenuStage, setChannelMenuStage] = useState<'channels' | 'types'>('channels');
    const [showPromptExamples, setShowPromptExamples] = useState(true);
    const [promptScrollState, setPromptScrollState] = useState({ canScrollPrev: false, canScrollNext: false });
    const channelMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!googleAccounts.length) return;
        if (!googleAccounts.some(acc => acc.id === selectedAccountId)) {
            onSelectAccount(googleAccounts[0].id);
        }
    }, [googleAccounts, selectedAccountId, onSelectAccount]);

    useEffect(() => {
        if (!channelMenuOpen) return;
        const handler = (event: MouseEvent) => {
            if (channelMenuRef.current && !channelMenuRef.current.contains(event.target as Node)) {
                setChannelMenuOpen(false);
                setChannelMenuStage('channels');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [channelMenuOpen]);

    const primaryChannel = selectedChannels[0];
    const channelDisplayIcon = getChannelIcon(primaryChannel ?? 'Channels');
    const channelDisplayLabel = primaryChannel ? (primaryChannel === 'Google' ? 'Adwords' : primaryChannel) : 'Channels';
    const promptExamplesRef = useRef<HTMLDivElement | null>(null);
    const activeGoogleAccount = useMemo(() => googleAccounts.find(acc => acc.id === selectedAccountId) || googleAccounts[0], [googleAccounts, selectedAccountId]);

    const toggleCampaignType = (type: string) => {
        setSelectedCampaignTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
    };

    const updatePromptScrollState = useCallback(() => {
        const container = promptExamplesRef.current;
        if (!container) return;
        const canScrollPrev = container.scrollLeft > 0;
        const canScrollNext = container.scrollLeft + container.clientWidth < container.scrollWidth - 1;
        setPromptScrollState({ canScrollPrev, canScrollNext });
    }, []);

    const scrollPromptExamples = (direction: 'prev' | 'next') => {
        const container = promptExamplesRef.current;
        if (!container) return;
        const scrollAmount = container.clientWidth * 0.8;
        container.scrollBy({ left: direction === 'next' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
        window.setTimeout(updatePromptScrollState, 200);
    };

    const applyPromptExample = (example: string) => {
        setChannelMenuOpen(false);
        setShowMarkets(false);
        setBrief(example);
    };

    useEffect(() => {
        if (!showPromptExamples) {
            setPromptScrollState({ canScrollPrev: false, canScrollNext: false });
            return;
        }
        const container = promptExamplesRef.current;
        if (!container) {
            updatePromptScrollState();
            return;
        }
        updatePromptScrollState();
        const handleScroll = () => updatePromptScrollState();
        container.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updatePromptScrollState);
        return () => {
            container.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', updatePromptScrollState);
        };
    }, [showPromptExamples, updatePromptScrollState]);

    // Markets dropdown state
    const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
    const assigned = useMemo(() => new Set(marketItems.flatMap(x => x.codes)), [marketItems]);
    const [q, setQ] = useState('');
    const [picked, setPicked] = useState<string[]>([]);
    const dropdownRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (!showMarkets) return;
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowMarkets(false);
                setQ('');
                setPicked([]);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [showMarkets]);
    const visibleMarkets = useMemo(() => {
        const base = MARKETS.filter(m => !assigned.has(m.code) || picked.includes(m.code));
        if (!q.trim()) return base;
        const s = q.trim().toLowerCase();
        return base.filter(m => m.name.toLowerCase().includes(s) || m.code.toLowerCase().includes(s));
    }, [q, assigned, picked]);
    const togglePick = (code: string) => setPicked(p => p.includes(code) ? p.filter(x => x !== code) : [...p, code]);
    const addMarketSingles = (codes: string[]) => {
        const add = dedupeCodes(codes, assigned);
        if (!add.length) return;
        setMarketItems(it => [...it, ...add.map(c => ({ type: 'single', name: findMarket(c)?.name || c, codes: [c] }))]);
    };
    const addMarketCluster = (codes: string[]) => {
        const add = dedupeCodes(codes, assigned);
        if (add.length < 2) return;
        const name = suggestClusterName(add);
        setMarketItems(it => [...it, { type: 'cluster', name, codes: add }]);
    };
    const removeItem = (index: number) => setMarketItems(it => it.filter((_, i) => i !== index));

    // Attachments
    const [attachments, setAttachments] = useState<{name:string; size:number}[]>([]);
    const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachments(files.map(f => ({ name: f.name, size: f.size })));
    };
    const removeAttachment = (index: number) => setAttachments(att => att.filter((_, i) => i !== index));
    const uploadInputRef = useRef<HTMLInputElement | null>(null);

    const detectKey = () => {
        try {
            return Boolean(
                (import.meta as any)?.env?.VITE_GEMINI_API_KEY ||
                (import.meta as any)?.env?.GEMINI_API_KEY ||
                (window as any)?.__GEMINI_API_KEY__ ||
                localStorage.getItem('GEMINI_API_KEY') ||
                localStorage.getItem('gemini_api_key')
            );
        } catch { return false; }
    };
    const [hasKey, setHasKey] = useState<boolean>(detectKey());
    const [keyInput, setKeyInput] = useState<string>('');

    const guidedSchema: GuidedPromptRequirement[] = useMemo(() => {
        const countryNames = COUNTRIES.map(c => c.name);
        const countryIsos = COUNTRIES.map(c => c.iso);
        return [
            {
                id: 'market',
                label: 'Market',
                instruction: 'Add the markets you want to target',
                detect: (text: string) => {
                    const t = text.toLowerCase();
                    const byName = countryNames.some(n => t.includes(n.toLowerCase()));
                    const byIso = countryIsos.some(iso => new RegExp(`\\b${iso.toLowerCase()}\\b`).test(t));
                    return byName || byIso || /market\s*:/.test(t);
                },
            },
            {
                id: 'type',
                label: 'Campaign Type',
                instruction: 'Specify which campaign type you want to create',
                detect: (text: string) => {
                    const t = text.toLowerCase();
                    return ALL_CAMPAIGN_TYPES.some(ct => t.includes(ct.toLowerCase())) || /campaign\s*type\s*:/.test(t);
                },
            },
            {
                id: 'hotel',
                label: 'Hotel Details',
                instruction: 'Tell us about the hotel (name, location, stars, USPs)',
                detect: (text: string) => /hotel|resort|property|rooms|stars|amenities|spa|pool|boutique|located|location|nearby/i.test(text),
            },
            {
                id: 'angle',
                label: 'Creative Direction',
                instruction: 'Share your angle/creative direction',
                detect: (text: string) => /angle|creative direction|theme|season(al)?|luxury|family|deal|romance|business|wellness|eco/i.test(text),
            },
        ];
    }, []);

    const handleGenerate = async () => {
        if (!brief.trim() || !hasKey || isParsingPrompt) return;
        setIsParsingPrompt(true);
        try {
            const singles = marketItems.filter(i => i.type === 'single');
            const clusters = marketItems.filter(i => i.type === 'cluster');
            let primaryMarkets: Market[] = singles.map(i => {
                const code = i.codes[0];
                const country = { name: findMarket(code)?.name || code, iso: code } as Omit<Market,'browserLangs'>;
                return getMarketWithLangs(country);
            });
            let secondaryMarkets: Market[] = [];
            if (clusters.length) {
                const allCodes = Array.from(new Set(clusters.flatMap(c => c.codes)));
                const name = allCodes.map(c => findMarket(c)?.name || c).join(', ');
                const langs = allCodes.map(c => getMarketWithLangs({ name: findMarket(c)?.name || c, iso: c }).browserLangs).flat();
                secondaryMarkets = [{ name, iso: 'WW', browserLangs: Array.from(new Set(langs)) }];
            }

            let promptMarkets: Market[] = [];
            let promptCampaignTypes: string[] = [];
            try {
                const extraction = await extractMarketsAndTypes(brief);
                if (extraction.markets?.length) {
                    promptMarkets = extraction.markets
                        .map(normalizeAiMarket)
                        .filter((m): m is Market => !!m);
                }
                if (extraction.campaignTypes?.length) {
                    promptCampaignTypes = extraction.campaignTypes
                        .map(canonicalizeCampaignType)
                        .filter((type): type is string => !!type);
                }
            } catch (error) {
                console.error('Failed to extract prompt metadata with AI', error);
            }

            const primaryMap = new Map<string, Market>(primaryMarkets.map(m => [m.iso, m]));
            promptMarkets.forEach(pm => {
                if (pm.iso && !primaryMap.has(pm.iso)) {
                    primaryMap.set(pm.iso, pm);
                }
            });
            primaryMarkets = Array.from(primaryMap.values());

            const combinedCampaignTypes = Array.from(new Set([...selectedCampaignTypes, ...promptCampaignTypes]));
            const hasManualData = primaryMarkets.length || secondaryMarkets.length || combinedCampaignTypes.length;
            const manual = hasManualData ? { primaryMarkets, secondaryMarkets, campaignTypes: combinedCampaignTypes } : undefined;
            onGenerate(brief, selectedChannels, manual, activeGoogleAccount?.id);
        } finally {
            setIsParsingPrompt(false);
        }
    };

    const isGenerateDisabled = !brief.trim() || selectedChannels.length === 0 || !hasKey || isParsingPrompt || (selectedChannels.includes('Google') && !googleAccounts.length);

    return (
        <div className="flex justify-center items-start pt-8 sm:pt-12">
            <div className="w-full max-w-2xl space-y-6">
                <div className="text-center">
                    <h2 className="text-lg font-medium text-gray-800 mb-6">What campaign you would like to launch</h2>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="p-4 pb-3 space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {marketItems.length === 0 ? (
                                <span className="text-xs text-gray-400">Use Markets to add countries or clusters.</span>
                            ) : (
                                marketItems.map((c, i) => (
                                    <span key={`market-pill-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs">
                                        {c.type === 'single' ? '🌐' : '����️'} {c.name}
                                        <button onClick={() => removeItem(i)} className="text-gray-500 hover:text-black">×</button>
                                    </span>
                                ))
                            )}
                            {selectedCampaignTypes.map(type => (
                                <span key={`type-pill-${type}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs">
                                    🎯 {type}
                                    <button onClick={() => toggleCampaignType(type)} className="text-gray-500 hover:text-black">×</button>
                                </span>
                            ))}
                        </div>
                        <GuidedPrompt value={brief} onChange={setBrief} schema={guidedSchema} placeholder="Enter a task" />
                        {showPromptExamples && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-medium text-gray-500">
                                    <span>Try one of these prompts</span>
                                    <button
                                        type="button"
                                        onClick={() => setShowPromptExamples(false)}
                                        className="text-xs font-normal text-gray-400 hover:text-gray-600"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => scrollPromptExamples('prev')}
                                        disabled={!promptScrollState.canScrollPrev}
                                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors ${promptScrollState.canScrollPrev ? 'hover:border-gray-300 hover:text-gray-900' : 'opacity-40 cursor-not-allowed'}`}
                                        aria-label="Scroll prompts left"
                                    >
                                        <ChevronLeftIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="relative flex-1 overflow-hidden">
                                        <div ref={promptExamplesRef} className="flex w-full flex-nowrap gap-2 overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                                            {PROMPT_EXAMPLES.map((example, index) => (
                                                <button
                                                    key={`prompt-example-${index}`}
                                                    type="button"
                                                    onClick={() => applyPromptExample(example)}
                                                    className="min-w-[240px] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900"
                                                >
                                                    {example}
                                                </button>
                                            ))}
                                        </div>
                                        <div
                                            aria-hidden="true"
                                            className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white via-white/80 to-transparent transition-opacity duration-200 ${promptScrollState.canScrollPrev ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        <div
                                            aria-hidden="true"
                                            className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent transition-opacity duration-200 ${promptScrollState.canScrollNext ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => scrollPromptExamples('next')}
                                        disabled={!promptScrollState.canScrollNext}
                                        className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors ${promptScrollState.canScrollNext ? 'hover:border-gray-300 hover:text-gray-900' : 'opacity-40 cursor-not-allowed'}`}
                                        aria-label="Scroll prompts right"
                                    >
                                        <ChevronRightIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative" ref={channelMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setChannelMenuOpen(prev => {
                                                const next = !prev;
                                                if (next) {
                                                    setShowMarkets(false);
                                                    setChannelMenuStage(selectedChannels.includes('Google') ? 'types' : 'channels');
                                                } else {
                                                    setChannelMenuStage('channels');
                                                }
                                                return next;
                                            });
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors"
>
                                        <span className="inline-flex items-center justify-center">{channelDisplayIcon}</span>
                                        <span className="flex items-center gap-1">
                                            <span>{channelDisplayLabel}</span>
                                            {primaryChannel && selectedCampaignTypes.length > 0 && (
                                                <span className="text-xs text-gray-500">• {selectedCampaignTypes.length} type{selectedCampaignTypes.length > 1 ? 's' : ''}</span>
                                            )}
                                        </span>
                                        <ChevronDownIcon className={`w-3 h-3 text-gray-400 transition-transform ${channelMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {channelMenuOpen && (
                                        <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl z-30">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-sm font-semibold text-gray-800">
                                                    {channelMenuStage === 'channels' ? 'Select channel' : 'Select campaign types'}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setChannelMenuOpen(false);
                                                        setChannelMenuStage('channels');
                                                    }}
                                                    className="text-xs text-gray-600 hover:text-gray-900"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                            {channelMenuStage === 'channels' ? (
                                                <div className="space-y-1">
                                                    {channelOptions.map(opt => {
                                                        const isDisabled = opt !== 'Google';
                                                        const isActive = selectedChannels.includes(opt as Channel);
                                                        return (
                                                            <button
                                                                key={opt}
                                                                type="button"
                                                                disabled={isDisabled}
                                                                onClick={() => {
                                                                    if (isDisabled) return;
                                                                    if (isActive) {
                                                                        setSelectedChannels([]);
                                                                        setSelectedCampaignTypes([]);
                                                                        setChannelMenuStage('channels');
                                                                        setChannelMenuOpen(false);
                                                                        return;
                                                                    }
                                                                    setSelectedChannels([opt as Channel]);
                                                                    if (opt === 'Google') {
                                                                        setChannelMenuStage('types');
                                                                    } else {
                                                                        setSelectedCampaignTypes([]);
                                                                        setChannelMenuStage('channels');
                                                                        setChannelMenuOpen(false);
                                                                    }
                                                                }}
                                                                className={`flex items-center justify-between w-full px-3 py-1 rounded-xl border transition-colors ${isActive ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-700'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                            >
                                                                <span className="inline-flex items-center gap-2">
                                                                    {getChannelIcon(opt, 'sm')}
                                                                    <span>{opt === 'Google' ? 'Adwords' : opt}</span>
                                                                </span>
                                                                {isDisabled && <span className="text-[10px] text-gray-500">Coming soon</span>}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : selectedChannels.includes('Google') ? (
                                                <div className="flex flex-col">
                                                    <button
                                                        type="button"
                                                        onClick={() => setChannelMenuStage('channels')}
                                                        className="mb-2 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1 text-sm text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
                                                    >
                                                        <ChevronLeftIcon className="w-3.5 h-3.5" />
                                                        <span>Return to channels</span>
                                                    </button>
                                                    <div className="space-y-1 max-h-40 overflow-auto pr-1">
                                                        {ALL_CAMPAIGN_TYPES.map(type => {
                                                            const active = selectedCampaignTypes.includes(type);
                                                            return (
                                                                <button
                                                                    key={type}
                                                                    type="button"
                                                                    onClick={() => toggleCampaignType(type)}
                                                                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-1 text-sm transition-colors ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-200 text-gray-700'}`}
                                                                >
                                                                    <span>{type}</span>
                                                                    {active && <CheckMarkIcon className="w-4 h-4" />}
                                                                </button>
                                                            );
                                                        })}
                                                        {ALL_CAMPAIGN_TYPES.length === 0 && (
                                                            <div className="text-xs text-gray-400">No campaign types available.</div>
                                                        )}
                                                    </div>
                                                    <div className="mt-1.5 flex justify-between gap-2">
                                                        <button type="button" onClick={() => setSelectedCampaignTypes([])} className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-gray-900">
                                                            Clear
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setChannelMenuOpen(false);
                                                                setChannelMenuStage('channels');
                                                            }}
                                                            className="text-xs px-3 py-1.5 rounded-full bg-black text-white"
                                                        >
                                                            Done
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-gray-500">Select a channel first.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setChannelMenuOpen(false);
                                            setShowMarkets(v => !v);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors"
                                    >
                                        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 19 20" fill="none" aria-hidden="true">
                                            <path d="M6.33913 10.6787H11.7386C11.6566 12.503 11.2521 14.1831 10.678 15.4135C10.3555 16.1065 10.0076 16.5958 9.68518 16.8956C9.36839 17.1926 9.1506 17.2407 9.03746 17.2407C8.92433 17.2407 8.70654 17.1926 8.38975 16.8956C8.06731 16.5958 7.71941 16.1036 7.39697 15.4135C6.82279 14.1831 6.41832 12.503 6.3363 10.6787H6.33913ZM11.7415 9.32103H6.34196C6.42115 7.49668 6.82562 5.81658 7.39979 4.58621C7.72224 3.89607 8.07014 3.40392 8.39258 3.1041C8.70937 2.80712 8.92716 2.75903 9.04029 2.75903C9.15343 2.75903 9.37122 2.80712 9.68801 3.1041C10.0104 3.40392 10.3583 3.89607 10.6808 4.58621C11.255 5.81658 11.6594 7.49668 11.7415 9.32103ZM13.0991 9.32103C13.0001 6.89988 12.375 4.65126 11.4614 3.17481C14.0664 4.09689 15.9841 6.46995 16.25 9.32103H13.0991ZM16.25 10.6787C15.9841 13.5298 14.0664 15.9028 11.4614 16.8249C12.375 15.3484 13.0001 13.0998 13.0991 10.6787H16.25ZM4.98147 10.6787C5.08047 13.0998 5.70556 15.3484 6.61914 16.8249C4.01415 15.9 2.09646 13.5298 1.83059 10.6787H4.98147ZM1.83059 9.32103C2.09646 6.46995 4.01415 4.09689 6.61914 3.17481C5.70556 4.65126 5.08047 6.89988 4.98147 9.32103H1.83059Z" fill="currentColor"/>
                                        </svg>
                                        <span>{marketItems.length === 0 ? 'Markets' : `${marketItems.length} market${marketItems.length > 1 ? 's' : ''}`}</span>
                                        <ChevronDownIcon className={`w-3 h-3 text-gray-400 transition-transform ${showMarkets ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showMarkets && (
                                        <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl z-30">
                                            <div className="text-sm font-semibold text-gray-800 mb-1">Add markets</div>
                                            <input
                                                autoFocus
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                                placeholder="Search countries…"
                                                className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-gray-300 focus:outline-none focus:ring-0 mb-1.5"
                                            />
                                            <div className="max-h-40 overflow-auto space-y-1 pr-1">
                                                {visibleMarkets.length > 0 ? (
                                                    visibleMarkets.map(m => (
                                                        <label
                                                            key={m.code}
                                                            className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-1 text-sm text-gray-700 transition-colors hover:border-gray-200 hover:bg-gray-50 cursor-pointer"
                                                        >
                                                            <input type="checkbox" className="h-4 w-4" checked={picked.includes(m.code)} onChange={() => togglePick(m.code)} />
                                                            <span className="flex-1">{m.name}</span>
                                                        </label>
                                                    ))
                                                ) : (
                                                    <div className="text-xs text-gray-400 px-3 py-2">No results</div>
                                                )}
                                            </div>
                                            {(() => { const acts = actionsForSelection(picked, assigned); return (
                                                <>
                                                    {acts.showAddMarket && (
                                                        <div className="mt-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    addMarketSingles(picked);
                                                                    setPicked([]);
                                                                    setQ('');
                                                                    setShowMarkets(false);
                                                                }}
                                                                className="w-full rounded-xl border border-gray-900 bg-gray-900 px-3 py-1 text-sm font-medium text-white transition-colors hover:border-black hover:bg-black"
                                                            >
                                                                Add market
                                                            </button>
                                                        </div>
                                                    )}
                                                    {(acts.showAddMarkets || acts.showAddCluster) && (
                                                        <div className="mt-1.5 flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    if (acts.showAddMarkets) addMarketSingles(picked);
                                                                    setPicked([]);
                                                                    setQ('');
                                                                    setShowMarkets(false);
                                                                }}
                                                                disabled={!acts.showAddMarkets}
                                                                className="flex-1 rounded-xl border border-gray-900 bg-gray-900 px-3 py-1 text-sm font-medium text-white transition-colors hover:border-black hover:bg-black disabled:opacity-40"
                                                            >
                                                                Add markets
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (acts.showAddCluster) addMarketCluster(picked);
                                                                    setPicked([]);
                                                                    setQ('');
                                                                    setShowMarkets(false);
                                                                }}
                                                                disabled={!acts.showAddCluster}
                                                                className="flex-1 rounded-xl border border-gray-200 px-3 py-1 text-sm font-medium transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40"
                                                            >
                                                                Add cluster
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            );})()}
                                        </div>
                                    )}
                                </div>
                                <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
                                <button onClick={() => uploadInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                                        <path d="M4 3C2.89688 3 2 3.89688 2 5V15C2 16.1031 2.89688 17 4 17H10.625C10.1969 16.4062 9.875 15.7281 9.6875 15H4.75C4.47188 15 4.2125 14.8438 4.08437 14.5969C3.95625 14.35 3.975 14.05 4.13438 13.8219L5.88438 11.3219C6.025 11.1219 6.25312 11.0031 6.5 11.0031C6.74688 11.0031 6.975 11.1219 7.11562 11.3219L7.94063 12.5031L9.85938 9.3625C9.99688 9.14063 10.2375 9.00313 10.5 9.00313C10.7625 9.00313 11.0031 9.14063 11.1406 9.3625L11.1469 9.375C12.2406 8.22187 13.7875 7.50313 15.5 7.50313C15.6688 7.50313 15.8344 7.50938 16 7.525V5C16 3.89688 15.1031 3 14 3H4ZM6 5.5C6.82812 5.5 7.5 6.17188 7.5 7C7.5 7.82812 6.82812 8.5 6 8.5C5.17188 8.5 4.5 7.82812 4.5 7C4.5 6.17188 5.17188 5.5 6 5.5ZM15.5 18C17.9844 18 20 15.9844 20 13.5C20 11.0156 17.9844 9 15.5 9C13.0156 9 11 11.0156 11 13.5C11 15.9844 13.0156 18 15.5 18ZM16 11.5V13H17.5C17.775 13 18 13.225 18 13.5C18 13.775 17.775 14 17.5 14H16V15.5C16 15.775 15.775 16 15.5 16C15.225 16 15 15.775 15 15.5V14H13.5C13.225 14 13 13.775 13 13.5C13 13.225 13.225 13 13.5 13H15V11.5C15 11.225 15.225 11 15.5 11C15.775 11 16 11.225 16 11.5Z" fill="currentColor"/>
                                    </svg>
                                    Upload
                                </button>
                                {attachments.map((f, i) => (
                                    <span key={`att-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-200 text-[11px]">
                                        📎 {f.name}
                                        <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-black">×</button>
                                    </span>
                                ))}
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerateDisabled}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                                {isParsingPrompt ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                {isParsingPrompt ? 'Parsing prompt…' : 'Create campaign'}
                            </button>
                        </div>
                        {!hasKey && (
                            <div className="pt-3 border-t border-gray-100">
                                <details className="text-xs text-gray-500">
                                    <summary className="cursor-pointer list-none underline underline-offset-2 decoration-dotted">Set Gemini key</summary>
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            type="password"
                                            value={keyInput}
                                            onChange={(e) => setKeyInput(e.target.value)}
                                            placeholder="Paste Gemini API key"
                                            className="px-2 py-1 text-xs border border-gray-200 rounded-md"
                                        />
                                        <button
                                            onClick={() => { if (keyInput.trim()) { try { localStorage.setItem('GEMINI_API_KEY', keyInput.trim()); setHasKey(true); } catch {} } }}
                                            className="px-2 py-1 text-xs rounded-md bg-black text-white hover:bg-gray-800"
                                        >Save</button>
                                    </div>
                                    <p className="mt-1 text-[10px] text-gray-500">Stored locally in your browser.</p>
                                </details>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const CampaignSummaryTable = ({ summaries, onSelect, onConfirm, onBack, onUpdate }: { summaries: CampaignSummary[], onSelect: (id: string) => void, onConfirm: () => void, onBack: () => void, onUpdate: (id: string, updater: (s: CampaignSummary) => CampaignSummary) => void }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const sortedSummaries = useMemo(() => {
        let sortableItems = [...summaries];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const key = sortConfig.key;
                let aValue: any, bValue: any;

                if (key === 'browserLangs') {
                    aValue = a.market.browserLangs.join(', ');
                    bValue = b.market.browserLangs.join(', ');
                } else if (key === 'market') {
                    aValue = a.market.name;
                    bValue = b.market.name;
                }
                 else {
                    aValue = a[key as keyof CampaignSummary];
                    bValue = b[key as keyof CampaignSummary];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        const uniqueItems: CampaignSummary[] = [];
        const seenIds = new Set<string>();
        for (const item of sortableItems) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
            uniqueItems.push(item);
        }
        return uniqueItems;
    }, [summaries, sortConfig]);
    
    const requestSort = (key: keyof CampaignSummary | 'browserLangs') => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'ascending' ? '↑' : '↓';
    };

    const [editingId, setEditingId] = useState<string | null>(null);

    const countryLabels = COUNTRIES.map(c => `${c.name} (${c.iso})`);
    const parseIso = (label: string) => (label.match(/\(([A-Z]{2})\)$/)?.[1] || '').trim();
    const marketNamesFromLabels = (labels: string[]) => labels.map(l => l.replace(/ \([A-Z]{2}\)$/, ''));
    const headers = [
        { key: 'campaignName', label: 'Campaigns' },
        { key: 'campaignType', label: 'Type' },
        { key: 'languages', label: 'Language' },
        { key: 'market', label: 'Country' },
        { key: 'actions', label: '' },
    ];

    const campaignTypeOptions = useMemo(() => {
        const unique = new Set<string>();
        summaries.forEach(summary => {
            if (summary.campaignType) {
                unique.add(summary.campaignType);
            }
        });
        ALL_CAMPAIGN_TYPES.forEach(type => unique.add(type));
        return Array.from(unique);
    }, [summaries]);

    return (
        <div className="campaign-summary-wrapper space-y-0">
            <div className="campaign-summary-table-container border border-gray-200 rounded-lg overflow-x-auto">
                <table className="campaign-summary-table w-full text-sm text-left text-gray-600 relative">
                    <thead className="campaign-summary-table__head text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            {headers.map(h => (
                                <th key={h.key} scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort(h.key as any)}>
                                    {h.label} {getSortIndicator(h.key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="campaign-summary-table__body">
                        {sortedSummaries.map(s => {
                            const isEditing = editingId === s.id;
                            const marketLabelList = (s.market.iso === 'WW' ? s.market.name.split(',').map(n => n.trim()) : [s.market.name]).map(name => `${name} (${COUNTRIES.find(c=>c.name===name)?.iso || s.market.iso})`);
                            return (
                            <React.Fragment key={s.id}>
                            <tr className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 flex items-center gap-4">
                                    <span className="inline-flex items-center justify-center">{getChannelIcon(s.channel, 'md')}</span>
                                    <span className="font-semibold text-gray-900">{s.campaignName}</span>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-sm">
                                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M16.6621 3.52486C16.1505 3.52486 15.7371 3.93822 15.7371 4.44986V4.71291L4.60242 7.89549C4.49258 7.50814 4.13414 7.22486 3.71211 7.22486C3.20047 7.22486 2.78711 7.63822 2.78711 8.14986V11.8499C2.78711 12.3615 3.20047 12.7749 3.71211 12.7749C4.13414 12.7749 4.49258 12.4916 4.60242 12.1042L6.675 12.6968C6.55359 13.009 6.48711 13.3472 6.48711 13.6999C6.48711 15.2319 7.73008 16.4749 9.26211 16.4749C10.6178 16.4749 11.748 15.5007 11.988 14.2144L15.7371 15.2839V15.547C15.7371 16.0586 16.1505 16.472 16.6621 16.472C17.1737 16.472 17.5871 16.0586 17.5871 15.547V4.44697C17.5871 3.93533 17.1737 3.52197 16.6621 3.52197V3.52486ZM10.6438 13.8299C10.5773 14.5353 9.98477 15.0874 9.26211 15.0874C8.49609 15.0874 7.87461 14.4659 7.87461 13.6999C7.87461 13.4773 7.92664 13.2663 8.01914 13.0813L10.6438 13.8299Z" fill="#888888"/>
                                        </svg>
                                        {s.campaignType}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-sm">
                                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M6.37435 2.54199C6.88138 2.54199 7.29102 2.95163 7.29102 3.45866V4.37533H10.9577C11.4647 4.37533 11.8743 4.78496 11.8743 5.29199C11.8743 5.79902 11.4647 6.20866 10.9577 6.20866H10.6827L10.4421 6.87038C9.97227 8.16517 9.26471 9.34824 8.37383 10.3652C8.7806 10.6173 9.20456 10.8407 9.6457 11.0383L11.0895 11.68L12.8712 7.6696C13.0173 7.3373 13.3467 7.12533 13.7077 7.12533C14.0686 7.12533 14.398 7.3373 14.5441 7.6696L18.2108 15.9196C18.4171 16.3837 18.2079 16.9251 17.7467 17.1285C17.2855 17.3318 16.7413 17.1256 16.5379 16.6644L15.965 15.3753H11.4533L10.8803 16.6644C10.6741 17.1284 10.1327 17.3347 9.67148 17.1285C9.21029 16.9222 9.00117 16.3808 9.20742 15.9196L10.3475 13.3558L8.90378 12.7141C8.24492 12.4219 7.61471 12.0725 7.01888 11.6714C6.40872 12.1641 5.74128 12.5938 5.02799 12.9519L4.03398 13.4446C3.58138 13.6709 3.03138 13.4876 2.80508 13.035C2.57878 12.5824 2.76211 12.0324 3.21471 11.8061L4.20299 11.3105C4.66992 11.0756 5.11393 10.8034 5.53216 10.4998C5.13685 10.136 4.76445 9.74355 4.41784 9.32819L4.12852 8.97871C3.80482 8.58913 3.85638 8.01048 4.24596 7.68678C4.63555 7.36309 5.21419 7.41465 5.53789 7.80423L5.83008 8.15371C6.15951 8.55189 6.52044 8.92142 6.90143 9.2623C7.68919 8.39147 8.31081 7.36881 8.72044 6.24303L8.73477 6.20866H2.71055C2.20065 6.20866 1.79102 5.79902 1.79102 5.29199C1.79102 4.78496 2.20065 4.37533 2.70768 4.37533H5.45768V3.45866C5.45768 2.95163 5.86732 2.54199 6.37435 2.54199ZM13.7077 10.2993L12.2668 13.542H15.1486L13.7077 10.2993Z" fill="#888888"/>
                                        </svg>
                                        {s.languages.map(langNameFromCode).join(', ')}
                                    </span>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-gray-200 bg-gray-100 text-gray-700 text-sm">
                                        <span className="text-base">{getCountryFlag(s.market.iso)}</span>
                                        {s.market.iso}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <button onClick={() => setEditingId(s.id)} className="text-xs px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">Edit Campaign</button>
                                </td>
                            </tr>
                            {isEditing && (
                                <tr className="campaign-edit-row bg-gray-50 border-b relative" key={`${s.id}-edit`}>
                                    <td colSpan={headers.length} className="campaign-edit-row__cell px-6 py-4 relative overflow-visible">
                                        <div className="campaign-edit-form grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
                                            <div className="campaign-edit-field">
                                                <label className="campaign-edit-field__label text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1 block">Campaign Name</label>
                                                <input
                                                    type="text"
                                                    value={s.campaignName}
                                                    onChange={(e)=> onUpdate(s.id, prev => ({...prev, campaignName: e.target.value}))}
                                                    className="campaign-edit-field__input w-full h-10 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                                />
                                            </div>
                                            <div className="campaign-edit-field">
                                                <label className="campaign-edit-field__label text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1 block">Campaign Type</label>
                                                <select
                                                    value={s.campaignType}
                                                    onChange={(e)=> onUpdate(s.id, prev => ({...prev, campaignType: e.target.value}))}
                                                    className="campaign-edit-field__select w-full h-10 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                                >
                                                    {campaignTypeOptions.map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="campaign-edit-field sm:col-span-2">
                                                <MultiSelectDropdown
                                                    label="Markets"
                                                    options={countryLabels}
                                                    selectedOptions={marketLabelList}
                                                    placeholder="Select markets..."
                                                    searchPlaceholder="Search countries"
                                                    onToggle={(label) => {
                                                        const currentSet = new Set<string>(marketLabelList);
                                                        if (currentSet.has(label)) currentSet.delete(label); else currentSet.add(label);
                                                        const arr = Array.from(currentSet);
                                                        const isos = arr.map(parseIso).filter(Boolean);
                                                        const names = marketNamesFromLabels(arr);
                                                        const langs = Array.from(new Set(isos.flatMap(iso => getMarketWithLangs({ name: findMarket(iso)?.name || iso, iso } as any).browserLangs)));
                                                        const nextMarket: Market = arr.length > 1 ? { name: names.join(', '), iso: 'WW', browserLangs: langs } : getMarketWithLangs({ name: names[0] || s.market.name, iso: isos[0] || s.market.iso } as any);
                                                        onUpdate(s.id, prev => ({...prev, market: nextMarket }));
                                                    }}
                                                />
                                            </div>
                                            <div className="campaign-edit-field sm:col-span-2">
                                                <label className="campaign-edit-field__label text-[11px] font-semibold uppercase tracking-wide text-gray-600 mb-1 block">Ad Language</label>
                                                <select
                                                    value={s.languages[0] ? langNameFromCode(s.languages[0]) : ''}
                                                    onChange={(e) => {
                                                        const selected = e.target.value;
                                                        const code = langCodeFromName(selected);
                                                        onUpdate(s.id, prev => ({ ...prev, languages: selected ? [code] : [] }));
                                                    }}
                                                    className="campaign-edit-field__select w-full h-10 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                                                >
                                                    <option value="">Select language...</option>
                                                    {LANGUAGE_LIST.map(l => (
                                                        <option key={l.code} value={l.name}>{l.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="campaign-edit-actions mt-4 flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditingId(null)}
                                                className="campaign-edit-actions__cancel text-xs px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingId(null)}
                                                className="campaign-edit-actions__done text-xs px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
                <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between">
                    <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm hover:bg-gray-200">
                        <BackIcon className="w-4 h-4" />
                        Back
                    </button>
                    <button onClick={onConfirm} className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                        <SparklesIcon className="w-4 h-4" />
                        Generate details
                    </button>
                </div>
            </div>
        </div>
    );
};

const DetailsView = ({ campaigns, brief, setCampaigns, onBack, onReview, openLibrary, goToCreative, openBanner }: { campaigns: FullCampaign[], brief: string, setCampaigns: React.Dispatch<React.SetStateAction<FullCampaign[]>>, onBack: () => void, onReview: () => void, openLibrary: (type: 'images'|'logos', max: number, onSelect: (urls: string[]) => void) => void, goToCreative: () => void, openBanner: (onSelect: (preset: BannerPreset) => void) => void }) => {
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(campaigns[0]?.id || null);
    const selectedCampaign = useMemo(() => campaigns.find(c => c.id === selectedCampaignId), [campaigns, selectedCampaignId]);

    const handleUpdate = (campaignId: string) => (path: (string | number)[], value: any) => {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? setIn(c, path, value) : c));
    };

    const handleAdd = (campaignId: string) => (path: (string | number)[], value: any) => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if(!campaign) return;
        
        let current = campaign;
        for(const key of path) {
            current = (current as any)[key];
        }
        const updatedList = [...(current as unknown as any[]), value];
        const updatedCampaign = setIn(campaign, path, updatedList);

        setCampaigns(prev => prev.map(c => c.id === campaignId ? updatedCampaign : c));
    };

    const handleDelete = (campaignId: string) => (path: (string | number)[]) => {
         setCampaigns(prev => prev.map(c => c.id === campaignId ? deleteIn(c, path) : c));
    };
    
    const handleGenerate = (campaign: FullCampaign) => async (assetType: AssetType, existing: string[]) => {
        return generateCreativeAsset(brief, campaign, assetType, existing);
    };

    const handleRewrite = (campaign: FullCampaign) => async (assetType: AssetType, existing: string[], toRewrite: string) => {
        return generateCreativeAsset(brief, campaign, assetType, existing, toRewrite);
    };

    return (
        <div className="space-y-0">
             <div className="grid grid-cols-12 w-full text-xs text-gray-600 border-b border-gray-200 bg-white">
                <div className="col-span-3 px-3 py-2 border-r border-gray-200">Campaigns</div>
                <div className="col-span-5 px-4 py-2 border-r border-gray-200">Details</div>
                <div className="col-span-4 px-4 py-2">Preview</div>
            </div>
            <div className="grid grid-cols-12 gap-0 bg-white w-full h-[calc(100vh-180px)] mt-0">
                <aside className="col-span-3 h-full overflow-auto border-r border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2"><div className="text-sm font-semibold text-gray-700">Campaigns</div><button aria-label="Create new campaign" onClick={() => { const id = self.crypto.randomUUID(); const newC: FullCampaign = { id, channel: 'Google', campaignName: 'New Campaign', campaignType: 'Brand Search', market: { name: 'United States', iso: 'US', browserLangs: ['en-US'] }, languages: ['en'], googleAds: { assetGroups: [], adGroups: [], ads: [] } as any }; setCampaigns(prev => [...prev, newC]); setSelectedCampaignId(id); }} className="text-xs px-2 py-1 rounded-md bg-black text-white hover:bg-gray-800">New</button></div>
                    <nav className="flex flex-col space-y-1" aria-label="Campaign list">
                        {campaigns.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCampaignId(c.id)}
                                className={`flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${selectedCampaignId === c.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
                            >
                                <span className="inline-flex items-center justify-center">{getChannelIcon(c.channel, 'md')}</span>
                                <div className="flex-grow">
                                    <p className="text-sm font-semibold">{c.campaignName}</p>
                                    <p className="text-xs text-gray-500">{c.market.name}</p>
                                </div>
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="col-span-5 h-full overflow-auto border-r border-gray-200 px-0 py-4">
                    {selectedCampaign && (
                        <div key={selectedCampaign.id}>
                            {selectedCampaign.channel === 'Google' && <GoogleCampaignDetails campaign={selectedCampaign} allCampaigns={campaigns} brief={brief} onUpdate={handleUpdate(selectedCampaign.id)} onAdd={handleAdd(selectedCampaign.id)} onDelete={handleDelete(selectedCampaign.id)} onGenerate={handleGenerate(selectedCampaign)} onRewrite={handleRewrite(selectedCampaign)} onPickFromLibrary={openLibrary} onOpenGenerator={goToCreative} onPickBanner={openBanner} />}
                            {selectedCampaign.channel === 'Meta' && <MetaCampaignDetails campaign={selectedCampaign} brief={brief} onUpdate={handleUpdate(selectedCampaign.id)} onAdd={handleAdd(selectedCampaign.id)} onDelete={handleDelete(selectedCampaign.id)} onGenerate={handleGenerate(selectedCampaign)} onRewrite={handleRewrite(selectedCampaign)} />}
                            {selectedCampaign.channel === 'TikTok' && <TikTokCampaignDetails campaign={selectedCampaign} brief={brief} onUpdate={handleUpdate(selectedCampaign.id)} onAdd={handleAdd(selectedCampaign.id)} onDelete={handleDelete(selectedCampaign.id)} onGenerate={handleGenerate(selectedCampaign)} onRewrite={handleRewrite(selectedCampaign)} />}
                        </div>
                    )}
                </main>
                <section className="col-span-4 h-full overflow-auto p-4">
                    {selectedCampaign && <CampaignPreview campaign={selectedCampaign} />}
                </section>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
                <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between">
                    <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-sm hover:bg-gray-200">
                        <BackIcon className="w-4 h-4" />
                        Back
                    </button>
                    <button onClick={onReview} className="flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-800">
                        <SparklesIcon className="w-4 h-4" />
                        Review & publish
                    </button>
                </div>
            </div>
        </div>
    );
};

// ===== Creative Generator View =====
const CreativeGeneratorView = ({ onSaveBanner, onPickFromLibrary, bannerPresets }: { onSaveBanner: (preset: Omit<BannerPreset,'id'|'createdAt'>) => void, onPickFromLibrary: (type: 'images'|'logos', max: number, onSelect: (urls: string[]) => void) => void, bannerPresets: BannerPreset[] }) => {
    const [prompt, setPrompt] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [logo, setLogo] = useState<string | null>(null);
    const [copy, setCopy] = useState<{ heading: string; subtext: string; cta: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [stage, setStage] = useState<'setup' | 'edit'>('setup');
    const [template, setTemplate] = useState<'overlay' | 'logo-badge' | 'text-panel' | 'split'>('overlay');
    const [justSaved, setJustSaved] = useState(false);
    const [accent, setAccent] = useState('#0ea5e9');
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const SIZES = [
        { key: '300x250', w: 300, h: 250, label: '300×250 • Medium rectangle' },
        { key: '336x280', w: 336, h: 280, label: '336×280 • Large rectangle' },
        { key: '728x90',  w: 728, h: 90,  label: '728×90 ���� Leaderboard' },
        { key: '300x600', w: 300, h: 600, label: '300×600 • Half page' },
        { key: '320x100', w: 320, h: 100, label: '320×100 • Large mobile banner' },
    ] as const;
    const [sizeKey, setSizeKey] = useState<'300x250' | '336x280' | '728x90' | '300x600' | '320x100'>('300x250');

    const updateImages = (updater: (current: string[]) => string[], focus?: number | 'first' | 'last') => {
        setImages(prevImages => {
            const nextImages = updater(prevImages).slice(0, 5);
            if (nextImages.length === 0) {
                setActiveImageIndex(0);
                return nextImages;
            }
            if (focus === 'last') {
                setActiveImageIndex(nextImages.length - 1);
            } else if (focus === 'first') {
                setActiveImageIndex(0);
            } else if (typeof focus === 'number' && focus >= 0 && focus < nextImages.length) {
                setActiveImageIndex(focus);
            } else {
                setActiveImageIndex(prev => {
                    const safeIndex = Math.min(prev, nextImages.length - 1);
                    return safeIndex < 0 ? 0 : safeIndex;
                });
            }
            return nextImages;
        });
    };

    const handleImageFiles = async (fileList: FileList | null) => {
        if (!fileList) return;
        const uploads = await Promise.all(
            Array.from(fileList).map(
                (file) =>
                    new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                    })
            )
        );
        updateImages((prev) => [...prev, ...uploads], 'last');
    };

    const generate = async () => {
        setIsLoading(true);
        try {
            const c = await generateBannerCopy(prompt);
            setCopy(c);
            setStage('edit');
        } finally { setIsLoading(false); }
    };

    const activeImage = images[activeImageIndex] || null;

    const selectNextImage = () => {
        if (!images.length) return;
        setActiveImageIndex(prev => (prev + 1) % images.length);
    };

    const selectPreviousImage = () => {
        if (!images.length) return;
        setActiveImageIndex(prev => (prev - 1 + images.length) % images.length);
    };

    const shuffleBackground = () => {
        if (images.length <= 1) return;
        const options = images.map((_, index) => index).filter(index => index !== activeImageIndex);
        if (!options.length) return;
        const randomIndex = options[Math.floor(Math.random() * options.length)];
        setActiveImageIndex(randomIndex);
    };

    const downloadHtml = (w: number, h: number) => {
        const bg = activeImage || '';
        const fallbackLogo = images.find((_, idx) => idx !== activeImageIndex);
        const lg = logo || fallbackLogo || '';
        const c = copy || { heading: 'Special Offer', subtext: 'Save on your next stay when you book direct.', cta: 'Book Now' };
        let html = '';
        const baseHead = `<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><style>*{box-sizing:border-box}body{margin:0}.banner{position:relative;width:${w}px;height:${h}px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;overflow:hidden;border:1px solid #e5e7eb;border-radius:8px}.bg{position:absolute;inset:0;background-image:url('${bg}');background-size:cover;background-position:center;filter:saturate(1.05)}</style></head><body>`;
        if (template === 'text-panel') {
            html = `${baseHead}<div class=\"banner\"><div class=\"bg\"></div><div class=\"panel\" style=\"position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.95);border-top:1px solid #e5e7eb;padding:12px;color:#111\"><h3 style=\"margin:0 0 4px 0;font-weight:800;line-height:1.1;font-size:${Math.max(12, Math.min(24, Math.round(h*0.16)))}px\">${c.heading}</h3><p style=\"margin:0 0 10px 0;opacity:.85;font-size:${Math.max(10, Math.min(16, Math.round(h*0.11)))}px\">${c.subtext}</p><a href=\"#\" style=\"display:inline-block;background:${accent};color:#fff;padding:6px 10px;border-radius:999px;font-weight:700;font-size:${Math.max(9, Math.min(14, Math.round(h*0.1)))}px;text-decoration:none\">${c.cta}</a></div>${lg ? `<img style=\"position:absolute;top:8px;right:8px;height:${Math.max(14, Math.min(24, Math.round(h*0.18)))}px\" src=\"${lg}\" alt=\"logo\"/>` : ''}</div></body></html>`;
        } else if (template === 'split') {
            const panelW = Math.round(w*0.42);
            html = `${baseHead}<div class=\"banner\"><div class=\"bg\"></div><div style=\"position:absolute;left:0;top:0;bottom:0;width:${panelW}px;background:rgba(255,255,255,.95);border-right:1px solid #e5e7eb;padding:12px;color:#111\"><h3 style=\"margin:0 0 4px 0;font-weight:800;line-height:1.1;font-size:${Math.max(12, Math.min(22, Math.round(h*0.14)))}px\">${c.heading}</h3><p style=\"margin:0 0 10px 0;opacity:.85;font-size:${Math.max(9, Math.min(14, Math.round(h*0.1)))}px\">${c.subtext}</p><a href=\"#\" style=\"display:inline-block;background:${accent};color:#fff;padding:6px 10px;border-radius:6px;font-weight:700;font-size:${Math.max(9, Math.min(13, Math.round(h*0.09)))}px;text-decoration:none\">${c.cta}</a>${lg ? `<img style=\"position:absolute;bottom:8px;left:12px;height:${Math.max(14, Math.min(24, Math.round(h*0.18)))}px\" src=\"${lg}\" alt=\"logo\"/>` : ''}</div></div></body></html>`;
        } else if (template === 'arch') {
            const archR = Math.max(40, Math.round(h*0.35));
            const photoW = Math.round(w*0.62);
            html = `${baseHead}<div class=\"banner\"><div style=\"position:absolute;inset:0;background:linear-gradient(135deg, ${accent}, #1e3a8a)\"></div><div style=\"position:absolute;right:0;top:0;height:100%;width:${photoW}px;\"><div style=\"position:absolute;right:0;top:0;height:100%;width:100%;overflow:hidden;border-top-left-radius:${archR}px;border-top-right-radius:${archR}px\">${bg ? `<img style=\"position:absolute;inset:0;width:100%;height:100%;object-fit:cover\" src=\"${bg}\"/>` : ''}</div></div><div style=\"position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding-left:12px;padding-right:${Math.round(w*0.4)}px;color:#fff\">${lg ? `<img style=\"height:${Math.max(14, Math.min(24, Math.round(h*0.18)))}px;margin-bottom:6px\" src=\"${lg}\"/>` : ''}<h3 style=\"margin:0 0 4px 0;font-weight:800;line-height:1.1;font-size:${Math.max(12, Math.min(24, Math.round(h*0.16)))}px\">${c.heading}</h3><p style=\"margin:0 0 10px 0;opacity:.95;font-size:${Math.max(10, Math.min(16, Math.round(h*0.11)))}px\">${c.subtext}</p><a href=\"#\" style=\"display:inline-block;background:#fff;color:#111;padding:6px 10px;border-radius:999px;font-weight:700;font-size:${Math.max(9, Math.min(14, Math.round(h*0.1)))}px;text-decoration:none\">${c.cta}</a></div></div></body></html>`;
        } else if (template === 'center-hero') {
            html = `${baseHead}<div class=\"banner\">${bg ? `<div class=\"bg\"></div>` : ''}<div style=\"position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55))\"></div><div style=\"position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;font-family:Georgia,Times,serif\"><div style=\"letter-spacing:.02em;font-size:${Math.max(14, Math.min(28, Math.round(h*0.18)))}px;font-weight:800\">${c.heading}</div><div style=\"margin-top:4px;opacity:.95;font-size:${Math.max(10, Math.min(16, Math.round(h*0.11)))}px\">${c.subtext}</div><a href=\"#\" style=\"margin-top:8px;display:inline-block;color:#fff;border:2px solid ${accent};padding:6px 10px;border-radius:6px;font-weight:700;font-size:${Math.max(9, Math.min(14, Math.round(h*0.1)))}px;text-decoration:none\">${c.cta}</a></div>${lg ? `<img style=\"position:absolute;top:8px;right:8px;height:${Math.max(14, Math.min(24, Math.round(h*0.18)))}px\" src=\"${lg}\"/>` : ''}</div></body></html>`;
        } else {
            html = `<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/><style>*{box-sizing:border-box}body{margin:0}.banner{position:relative;width:${w}px;height:${h}px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;overflow:hidden;border:1px solid #e5e7eb;border-radius:8px}.bg{position:absolute;inset:0;background-image:url('${bg}');background-size:cover;background-position:center;filter:saturate(1.05)}.overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.4),rgba(0,0,0,.35))}</style></head><body><div class=\"banner\"><div class=\"bg\"></div><div class=\"overlay\"></div>${template==='logo-badge' && lg ? `<div style=\"position:absolute;top:8px;left:8px;background:#fff;border-radius:6px;padding:6px;box-shadow:0 2px 6px rgba(0,0,0,.15)\"><img style=\"height:${Math.max(14, Math.min(24, Math.round(h*0.18)))}px\" src=\"${lg}\"/></div>` : (lg ? `<img style=\"position:absolute;top:8px;right:8px;height:${Math.max(14, Math.min(24, Math.round(h*0.18)))}px\" src=\"${lg}\" alt=\"logo\"/>` : '')}<div style=\"position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:12px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)\"><h3 style=\"margin:0 0 4px 0;font-weight:800;line-height:1.1;font-size:${Math.max(12, Math.min(24, Math.round(h*0.16)))}px\">${c.heading}</h3><p style=\"margin:0 0 10px 0;opacity:.95;font-size:${Math.max(10, Math.min(16, Math.round(h*0.11)))}px\">${c.subtext}</p><a href=\"#\" style=\"display:inline-block;background:${accent};color:#fff;padding:6px 10px;border-radius:999px;font-weight:700;font-size:${Math.max(9, Math.min(14, Math.round(h*0.1)))}px;text-decoration:none\">${c.cta}</a></div></div></body></html>`;
        }
        const blob = new Blob([html], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `banner-${w}x${h}.html`;
        a.click();
        setTimeout(()=> URL.revokeObjectURL(a.href), 1000);
    };

    return (
        <div className={stage==='setup' ? 'space-y-4 pb-16 max-w-3xl mx-auto px-4' : 'flex flex-col gap-4 min-h-[calc(100vh-120px)] px-4 pb-6'}>
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-base font-semibold text-gray-800">AI Creative generator</div>
                    <div className="text-xs text-gray-500">Upload brand assets and generate HTML5 banners</div>
                </div>
                <button onClick={generate} disabled={isLoading} className={`px-4 py-2 rounded-full bg-black text-white text-sm disabled:bg-gray-400 ${stage==='edit' ? 'hidden' : ''}`}>{isLoading ? 'Generating…' : 'Generate banners'}</button>
            </div>
            <div className={stage==='setup' ? 'grid grid-cols-1 gap-4 max-w-2xl mx-auto w-full' : 'grid grid-cols-12 gap-6 flex-1 overflow-hidden w-full'}>
                <div className={stage==='setup' ? '' : 'md:col-span-4 h-full overflow-y-auto pr-6'}>
                    {stage==='edit' && (
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-sm font-semibold text-gray-800">Creative inputs</div>
                                <div className="text-xs text-gray-500">Adjust assets and layout</div>
                            </div>
                            <button
                                onClick={() => {
                                    setStage('setup');
                                    setCopy(null);
                                    setActiveImageIndex(0);
                                }}
                                className="text-xs text-gray-500 hover:text-gray-900"
                            >
                                Start over
                            </button>
                        </div>
                    )}
                    <label className="block text-xs text-gray-600 mb-1">Prompt</label>
                    <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} className="w-full border border-gray-200 rounded-md p-2 text-sm min-h-28" placeholder="Write a short brief about the offer, property, and audience" />
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <div className="text-sm font-medium text-gray-800">Images</div>
                            <div className="text-xs text-gray-500 mb-2">Upload 1–5 photos (used as background)</div>
                            <input
                                id="creative-images"
                                type="file"
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                    handleImageFiles(e.target.files);
                                    e.currentTarget.value = '';
                                }}
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                                {images.map((src, index) => (
                                    <button
                                        type="button"
                                        key={index}
                                        onClick={() => setActiveImageIndex(index)}
                                        aria-pressed={activeImageIndex === index}
                                        className={`relative rounded-md overflow-hidden border focus:outline-none focus:ring-2 focus:ring-blue-500 ${activeImageIndex === index ? 'ring-2 ring-blue-500 border-blue-200' : ''}`}
                                    >
                                        <img src={src} className="w-16 h-16 object-cover" alt={`Background ${index + 1}`} />
                                        {activeImageIndex === index && (
                                            <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-[10px] font-medium text-gray-700">
                                                Active
                                            </span>
                                        )}
                                    </button>
                                ))}
                                <label htmlFor="creative-images" className="px-2 py-1.5 text-xs rounded-md border cursor-pointer">
                                    Add images
                                </label>
                                <button
                                    onClick={() => onPickFromLibrary('images', 5, (urls) => updateImages((prev) => [...prev, ...urls]))}
                                    className="px-2 py-1.5 text-xs rounded-md border"
                                >
                                    Use library
                                </button>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-800">Logo</div>
                            <div className="text-xs text-gray-500 mb-2">SVG or PNG logo for branding</div>
                            <input id="creative-logo" type="file" className="hidden" accept="image/*" onChange={async (e)=> { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setLogo(r.result as string); r.readAsDataURL(f); }} />
                            <div className="flex items-center gap-2 flex-wrap">
                                {logo && <img src={logo} className="h-8 w-auto object-contain border rounded" alt="logo" />}
                                <label htmlFor="creative-logo" className="px-2 py-1.5 text-xs rounded-md border cursor-pointer">Upload logo</label>
                                <button onClick={()=> onPickFromLibrary('logos', 1, (urls)=> setLogo(urls[0] || null))} className="px-2 py-1.5 text-xs rounded-md border">Use library</button>
                            </div>
                        </div>
                    </div>

                    <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 ${stage==='setup' ? 'hidden' : ''}`}>
                        <div>
                            <div className="text-sm font-medium text-gray-800">Template</div>
                            <div className="text-xs text-gray-500 mb-2">Choose a layout</div>
                            <div className="flex flex-wrap gap-2">
                                {([
                                    { id:'overlay', label:'Photo overlay' },
                                    { id:'logo-badge', label:'Logo on white' },
                                    { id:'text-panel', label:'Text on white' },
                                    { id:'split', label:'Split panel' },
                                    { id:'stripe', label:'Accent stripe' },
                                    { id:'glass', label:'Glass panel' },
                                    { id:'outline', label:'Outline CTA' },
                                    { id:'arch', label:'Arch window' },
                                    { id:'center-hero', label:'Centered hero' },
                                ] as const).map(t => (
                                    <button key={t.id} onClick={()=> setTemplate(t.id as any)} className={`px-2 py-1.5 text-xs rounded-md border ${template===t.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:bg-gray-50'}`}>{t.label}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-800">Accent color</div>
                            <div className="text-xs text-gray-500 mb-2">Used for buttons and accents</div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {['#0ea5e9','#2563eb','#10b981','#f59e0b','#ef4444','#111827'].map(c => (
                                    <button key={c} aria-label={`Use ${c}`} onClick={()=> setAccent(c)} className={`w-6 h-6 rounded-full border ${accent===c ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`} style={{background:c}} />
                                ))}
                                <input type="color" value={accent} onChange={(e)=> setAccent(e.target.value)} className="w-8 h-6 border rounded" />
                            </div>
                        </div>
                    </div>

                    <div className={`mt-3 ${stage==='setup' ? 'hidden' : ''}`}>
                        <div className="text-sm font-medium text-gray-800 mb-2">Copy</div>
                        <div className="text-xs text-gray-500 mb-2">Edit banner text</div>
                        <div className="space-y-2">
                            <input value={copy?.heading || ''} onChange={(e)=> setCopy({ ...(copy || { heading:'', subtext:'', cta:'' }), heading: e.target.value })} placeholder="Headline" className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
                            <input value={copy?.subtext || ''} onChange={(e)=> setCopy({ ...(copy || { heading:'', subtext:'', cta:'' }), subtext: e.target.value })} placeholder="Subtext" className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
                            <input value={copy?.cta || ''} onChange={(e)=> setCopy({ ...(copy || { heading:'', subtext:'', cta:'' }), cta: e.target.value })} placeholder="Button label" className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
                        </div>
                    </div>
                </div>
                <div className={stage==='setup' ? 'hidden' : 'md:col-span-5 h-full overflow-y-auto pr-4'}>
                    <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                        <div className="text-sm font-medium text-gray-800">Preview</div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1">
                                {SIZES.map(s => (
                                    <button key={s.key} onClick={()=> setSizeKey(s.key as any)} className={`px-2 py-1.5 text-xs rounded-md border ${sizeKey===s.key ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:bg-gray-50'}`}>{s.key}</button>
                                ))}
                            </div>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={selectPreviousImage} disabled={images.length <= 1} className="px-2 py-1.5 text-xs rounded-md border disabled:cursor-not-allowed disabled:opacity-50">Prev</button>
                                <button type="button" onClick={selectNextImage} disabled={images.length <= 1} className="px-2 py-1.5 text-xs rounded-md border disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                                <button type="button" onClick={shuffleBackground} disabled={images.length <= 1} className="px-2 py-1.5 text-xs rounded-md border disabled:cursor-not-allowed disabled:opacity-50">Shuffle</button>
                            </div>
                        </div>
                    </div>
                    {(() => {
                        const s = SIZES.find(x => x.key === sizeKey) || SIZES[0];
                        return (
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                                    <span>{images.length ? s.label : 'Add background images to see preview'}</span>
                                    {images.length > 0 && (
                                        <span className="text-[11px] text-gray-500">Image {activeImageIndex + 1} of {images.length}</span>
                                    )}
                                </div>
                                <div className="flex flex-1 items-center justify-center rounded-xl bg-gray-50">
                                    <div className="relative" style={{width: s.w, height: s.h}}>
                                        {activeImage && <img src={activeImage} className="absolute inset-0 w-full h-full object-cover" alt="Background" />}
                                        {template !== 'text-panel' && template !== 'split' && template !== 'outline' && template !== 'stripe' && template !== 'glass' && template !== 'arch' && template !== 'center-hero' && (<div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/35" />)}

                                        {template === 'logo-badge' && logo && (
                                            <div className="absolute top-2 left-2 bg-white rounded-md shadow px-2 py-1">
                                                <img src={logo} className="h-5 w-auto object-contain" alt="logo" />
                                            </div>
                                        )}
                                        {template === 'overlay' && logo && (<img src={logo} className="absolute top-2 right-2 h-5 w-auto object-contain" alt="logo" />)}

                                        {template === 'text-panel' && (
                                            <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-gray-200 p-2 text-gray-900">
                                                <div className="font-extrabold leading-tight" style={{fontSize: Math.max(12, Math.min(24, Math.round(s.h*0.16)))}}>{copy?.heading || 'Special Offer'}</div>
                                                <div className="opacity-80" style={{fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                                <div>
                                                    <button className="mt-1 px-2 py-1 rounded-full text-white font-bold" style={{ background: accent, fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                                </div>
                                                {logo && <img src={logo} className="absolute top-2 right-2 h-5 w-auto object-contain" alt="logo" />}
                                            </div>
                                        )}

                                        {template === 'split' && (
                                            <>
                                                <div className="absolute left-0 top-0 bottom-0 bg-white/95 border-r border-gray-200 p-2 text-gray-900" style={{width: Math.round(s.w*0.42)}}>
                                                    <div className="font-extrabold leading-tight" style={{fontSize: Math.max(12, Math.min(22, Math.round(s.h*0.14)))}}>{copy?.heading || 'Special Offer'}</div>
                                                    <div className="opacity-80" style={{fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                                    <div>
                                                        <button className="mt-1 px-2 py-1 rounded-md text-white font-bold" style={{ background: accent, fontSize: Math.max(9, Math.min(13, Math.round(s.h*0.09)))}}>{copy?.cta || 'Book Now'}</button>
                                                    </div>
                                                    {logo && <img src={logo} className="absolute bottom-2 left-2 h-5 w-auto object-contain" alt="logo" />}
                                                </div>
                                            </>
                                        )}

                                        {template === 'stripe' && (
                                            <div className="absolute inset-x-0 bottom-0" style={{background: accent}}>
                                                <div className="p-2 text-white">
                                                    <div className="font-extrabold leading-tight" style={{fontSize: Math.max(12, Math.min(22, Math.round(s.h*0.14)))}}>{copy?.heading || 'Special Offer'}</div>
                                                    <div className="opacity-95" style={{fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                                    <button className="mt-1 px-2 py-1 rounded-full bg-white text-gray-900 font-bold" style={{fontSize: Math.max(9, Math.min(13, Math.round(s.h*0.09)))}}>{copy?.cta || 'Book Now'}</button>
                                                </div>
                                            </div>
                                        )}

                                        {template === 'glass' && (
                                            <div className="absolute inset-x-2 bottom-2 rounded-md border border-white/40" style={{background:'rgba(255,255,255,0.35)', backdropFilter:'blur(6px)'}}>
                                                <div className="p-2 text-gray-900">
                                                    <div className="font-extrabold leading-tight" style={{fontSize: Math.max(12, Math.min(22, Math.round(s.h*0.14)))}}>{copy?.heading || 'Special Offer'}</div>
                                                    <div className="opacity-80" style={{fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                                    <button className="mt-1 px-2 py-1 rounded-md text-white font-bold" style={{ background: accent, fontSize: Math.max(9, Math.min(13, Math.round(s.h*0.09)))}}>{copy?.cta || 'Book Now'}</button>
                                                </div>
                                            </div>
                                        )}

                                        {template === 'outline' && (
                                            <div className="absolute inset-0 flex flex-col justify-end p-2 text-white">
                                                <div className="font-extrabold leading-tight" style={{fontSize: Math.max(12, Math.min(24, Math.round(s.h*0.16)))}}>{copy?.heading || 'Special Offer'}</div>
                                                <div className="opacity-95" style={{fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                                <div>
                                                    <button className="mt-1 px-2 py-1 rounded-full font-bold border" style={{ borderColor: accent, color: '#fff', fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                                </div>
                                                {logo && <img src={logo} className="absolute top-2 right-2 h-5 w-auto object-contain" alt="logo" />}
                                            </div>
                                        )}

                                        {template === 'arch' && (
                                            <>
                                                <div className="absolute inset-0" style={{background: `linear-gradient(135deg, ${accent}, #1e3a8a)`}} />
                                                <div className="absolute right-0 top-0 h-full" style={{width: Math.round(s.w*0.62)}}>
                                                    <div className="absolute right-0 top-0 h-full overflow-hidden" style={{width:'100%', borderTopLeftRadius: Math.round(s.w*0.35), borderTopRightRadius: Math.round(s.w*0.35)}}>
                                                        {activeImage && <img src={activeImage} className="absolute inset-0 w-full h-full object-cover" alt="Background" />}
                                                    </div>
                                                </div>
                                                <div className="absolute inset-0 flex flex-col justify-center pl-3 pr-[40%] text-white">
                                                    {logo && <img src={logo} className="h-5 w-auto object-contain mb-1" alt="logo" />}
                                                    <div className="font-extrabold leading-tight" style={{fontSize: Math.max(12, Math.min(24, Math.round(s.h*0.16)))}}>{copy?.heading || 'Special Offer'}</div>
                                                    <div className="opacity-95 mt-1" style={{fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                                    <div>
                                                        <button className="mt-2 px-2 py-1 rounded-full bg-white text-gray-900 font-bold" style={{fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {template === 'center-hero' && (
                                            <>
                                                {activeImage && <img src={activeImage} className="absolute inset-0 w-full h-full object-cover" alt="Background" />}
                                                <div className="absolute inset-0" style={{background:'linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55))'}} />
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center" style={{fontFamily:'Georgia, Times, serif'}}>
                                                    <div className="tracking-wide" style={{fontSize: Math.max(14, Math.min(28, Math.round(s.h*0.18))), fontWeight:800}}>{copy?.heading || 'Feels Like Home'}</div>
                                                    <div className="mt-1 opacity-95" style={{fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Book direct for perks'}</div>
                                                    <button className="mt-2 px-2 py-1 rounded-md font-bold" style={{border:`2px solid ${accent}`, background:'transparent', color:'#fff', fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                                </div>
                                                {logo && <img src={logo} className="absolute top-2 right-2 h-5 w-auto object-contain" alt="logo" />}
                                            </>
                                        )}

                                        {(template === 'overlay' || template === 'logo-badge') && (
                                            <div className="absolute inset-0 flex flex-col justify-end p-2 text-white">
                                                <div className="font-extrabold leading-tight" style={{fontSize: Math.max(12, Math.min(24, Math.round(s.h*0.16)))}}>{copy?.heading || 'Special Offer'}</div>
                                                <div className="opacity-95" style={{fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                                <div>
                                                    <button className="mt-1 px-2 py-1 rounded-full text-white font-bold" style={{ background: accent, fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-[11px] text-gray-500">
                                    <span>{justSaved ? 'Saved to library' : ''}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => {
                                            const usedCopy = copy || { heading: 'Special Offer', subtext: 'Save on your next stay when you book direct.', cta: 'Book Now' };
                                            const name = `Banner ${new Date().toLocaleString()}`;
                                            { const s = SIZES.find(x => x.key === sizeKey) || SIZES[0]; onSaveBanner({ name, prompt, images, logo, copy: usedCopy, template, accent, sizeKey, width: s.w, height: s.h }); }
                                            setJustSaved(true);
                                            setTimeout(()=> setJustSaved(false), 1500);
                                        }} className="text-xs px-3 py-1.5 rounded-md border">Save to library</button>
                                        {s && <button onClick={()=> downloadHtml(s.w, s.h)} className="text-xs px-3 py-1.5 rounded-md border">Download HTML</button>}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
                <div className={stage==='setup' ? 'hidden' : 'md:col-span-3 h-full overflow-y-auto pl-4'}>
                    <div className="text-sm font-medium text-gray-800 mb-2">Saved banners</div>
                    <div className="space-y-2">
                        {bannerPresets?.length === 0 && (
                            <div className="text-xs text-gray-500">No saved banners yet.</div>
                        )}
                        {bannerPresets?.map(p => (
                            <button key={p.id} onClick={()=> { setPrompt(p.prompt || ''); updateImages(() => (p.images ? [...p.images] : []), 0); setLogo(p.logo || null); setCopy(p.copy || null as any); setTemplate(p.template as any); setAccent(p.accent); setStage('edit'); }} className="w-full border rounded-md bg-white hover:shadow text-left">
                                <div className="relative bg-gray-50 rounded-t-md overflow-hidden" style={{ aspectRatio: (p as any).width && (p as any).height ? (p as any).width + '/' + (p as any).height : (p.sizeKey==='336x280'?'336/280': p.sizeKey==='728x90'?'728/90': p.sizeKey==='300x600'?'300/600': p.sizeKey==='320x100'?'320/100':'300/250') }}>
                                    {p.images?.[0] && <img src={p.images[0]} className="absolute inset-0 w-full h-full object-cover" alt={p.name} />}
                                    {(p.template === 'overlay' || p.template === 'center-hero') && (<div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/35" />)}
                                    {p.template === 'text-panel' && (
                                        <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-gray-200 p-2 text-gray-900">
                                            <div className="font-bold text-[12px] truncate">{p.copy?.heading}</div>
                                            <div className="opacity-80 text-[11px] truncate">{p.copy?.subtext}</div>
                                        </div>
                                    )}
                                    {p.template === 'split' && (
                                        <div className="absolute left-0 top-0 bottom-0 bg-white/95 border-r border-gray-200 p-2 text-gray-900 w-[46%]">
                                            <div className="font-bold text-[12px] truncate">{p.copy?.heading}</div>
                                            <div className="opacity-80 text-[11px] truncate">{p.copy?.subtext}</div>
                                        </div>
                                    )}
                                    {p.logo && <img src={p.logo} className="absolute top-2 right-2 h-4 w-auto object-contain" alt="logo" />}
                                </div>
                                <div className="p-2">
                                    <div className="text-xs font-medium text-gray-800 truncate">{p.name}</div>
                                    <div className="text-[11px] text-gray-500 truncate">{p.template}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};

// ===== Creative Generator V2 View =====
const CreativeGeneratorV2View = ({ onSaveBanner, onPickFromLibrary, bannerPresets }: { onSaveBanner: (preset: Omit<BannerPreset,'id'|'createdAt'>) => void, onPickFromLibrary: (type: 'images'|'logos', max: number, onSelect: (urls: string[]) => void) => void, bannerPresets: BannerPreset[] }) => {
    const [prompt, setPrompt] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [logo, setLogo] = useState<string | null>(null);
    const [copy, setCopy] = useState<{ heading: string; subtext: string; cta: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [template, setTemplate] = useState<'overlay'|'text-panel'|'split'|'center-hero'>('overlay');
    const [accent, setAccent] = useState('#2563eb');
    const [headingColor, setHeadingColor] = useState<string>('#ffffff');
    const [bodyColor, setBodyColor] = useState<string>('#ffffff');
    const [ctaColor, setCtaColor] = useState<string>('#ffffff');
    const [font, setFont] = useState<string>('Inter');
    const [justSaved, setJustSaved] = useState(false);

    const SIZES = [
        { key: '300x250', w: 300, h: 250, label: '300×250 • Medium rectangle' },
        { key: '336x280', w: 336, h: 280, label: '336×280 • Large rectangle' },
        { key: '728x90',  w: 728, h: 90,  label: '728×90 • Leaderboard' },
        { key: '300x600', w: 300, h: 600, label: '300×600 • Half page' },
        { key: '320x100', w: 320, h: 100, label: '320×100 • Large mobile banner' },
    ] as const;
    const [sizeKey, setSizeKey] = useState<'300x250' | '336x280' | '728x90' | '300x600' | '320x100'>('300x250');
    const [activeImage, setActiveImage] = useState(0);

    useEffect(() => {
        if (!font) return;
        const family = font.replace(/\s+/g,'+');
        const id = `gf-${family}`;
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;600;700;800&display=swap`;
            document.head.appendChild(link);
        }
    }, [font]);

    const onFiles = async (fileList: FileList | null, set: (arr: string[]) => void, appendTo?: string[]) => {
        if (!fileList) return;
        const arr = await Promise.all(Array.from(fileList).map(f => new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); })));
        const next = [...(appendTo || []), ...arr];
        set(next);
    };

    const generate = async () => {
        setIsLoading(true);
        try {
            const c = await generateBannerCopy(prompt);
            setCopy(c);
        } finally { setIsLoading(false); }
    };

    const validHttp = (u?: string | null) => !!u && /^https?:\/\//i.test(u);

    const applyTemplate = (t: 'overlay'|'text-panel'|'split'|'center-hero') => {
        setTemplate(t);
        if (t === 'overlay' || t === 'center-hero') {
            setHeadingColor('#ffffff');
            setBodyColor('#ffffff');
            setCtaColor('#ffffff');
        } else {
            setHeadingColor('#111827');
            setBodyColor('#111827');
            setCtaColor('#ffffff');
        }
    };

    const exportOg = () => {
        const s = SIZES.find(x => x.key === sizeKey) || SIZES[0];
        const params = new URLSearchParams({
            title: copy?.heading || 'Special Offer',
            subtitle: copy?.subtext || 'Save on your next stay when you book direct.',
            cta: copy?.cta || 'Book Now',
            accent,
            font,
            hc: headingColor,
            bc: bodyColor,
            cc: ctaColor,
            template,
            w: String(s.w),
            h: String(s.h),
        });
        if (validHttp(images[activeImage])) params.set('image', images[activeImage]!);
        if (validHttp(logo)) params.set('logo', logo!);
        const url = `/api/og?${params.toString()}`;
        window.open(url, '_blank');
    };

    return (
        <div className="w-full h-[calc(100vh-180px)] bg-white border border-gray-200 rounded-lg overflow-hidden grid grid-cols-12">
            <aside className="col-span-3 h-full overflow-auto border-r border-gray-200 p-3">
                <div className="mb-3">
                    <div className="text-sm font-semibold text-gray-800">Creative parameters</div>
                    <div className="text-xs text-gray-500">Set content, fonts and colors</div>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs text-gray-600 mb-1">Prompt</label>
                        <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} className="w-full border border-gray-200 rounded-md p-2 text-sm min-h-24" placeholder="Write a short brief" />
                        <div className="mt-2 flex gap-2">
                            <button onClick={generate} disabled={isLoading} className="px-3 py-1.5 text-xs rounded-md bg-black text-white disabled:bg-gray-400">{isLoading ? 'Generating…' : 'Generate copy'}</button>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-800">Images</div>
                        <div className="text-xs text-gray-500 mb-2">Upload 1–5 photos</div>
                        <input id="v2-images" type="file" className="hidden" accept="image/*" multiple onChange={(e)=> onFiles(e.target.files, setImages, images)} />
                        <div className="flex items-center gap-2 flex-wrap">
                            {images.map((src, i) => (
                                <button key={i} onClick={()=> setActiveImage(i)} className={`relative rounded-md overflow-hidden border ${activeImage===i ? 'ring-2 ring-blue-500' : ''}`} aria-label={`Select image ${i+1} as background`}>
                                    <img src={src} className="w-16 h-16 object-cover" alt={`img ${i+1}`} />
                                    {activeImage===i && <span className="absolute bottom-1 left-1 bg-white/90 text-[10px] px-1 py-0.5 rounded">Active</span>}
                                </button>
                            ))}
                            <label htmlFor="v2-images" className="px-2 py-1.5 text-xs rounded-md border cursor-pointer">Add images</label>
                            <button onClick={()=> onPickFromLibrary('images', 5, (urls)=> setImages([...(images||[]), ...urls].slice(0,5)))} className="px-2 py-1.5 text-xs rounded-md border">Use library</button>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-800">Logo</div>
                        <div className="text-xs text-gray-500 mb-2">SVG or PNG</div>
                        <input id="v2-logo" type="file" className="hidden" accept="image/*" onChange={async (e)=> { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setLogo(r.result as string); r.readAsDataURL(f); }} />
                        <div className="flex items-center gap-2 flex-wrap">
                            {logo && <img src={logo} className="h-8 w-auto object-contain border rounded" alt="logo" />}
                            <label htmlFor="v2-logo" className="px-2 py-1.5 text-xs rounded-md border cursor-pointer">Upload logo</label>
                            <button onClick={()=> onPickFromLibrary('logos', 1, (urls)=> setLogo(urls[0] || null))} className="px-2 py-1.5 text-xs rounded-md border">Use library</button>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-800">Template</div>
                        <div className="text-xs text-gray-500 mb-2">Simplified layouts</div>
                        <div className="flex flex-wrap gap-2">
                            {([
                                { id:'overlay', label:'Photo overlay' },
                                { id:'text-panel', label:'Text on white' },
                                { id:'split', label:'Split panel' },
                                { id:'center-hero', label:'Centered hero' },
                            ] as const).map(t => (
                                <button key={t.id} onClick={()=> applyTemplate(t.id as any)} className={`px-2 py-1.5 text-xs rounded-md border ${template===t.id ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:bg-gray-50'}`}>{t.label}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-800">Typography</div>
                        <div className="text-xs text-gray-500 mb-1">Google Fonts</div>
                        <select value={font} onChange={(e)=> setFont(e.target.value)} className="w-full text-xs border border-gray-200 rounded-md px-2 py-1 bg-white">
                            {['Inter','Poppins','Montserrat','Playfair Display','Lora','Roboto','Nunito','Merriweather'].map(f => (<option key={f} value={f}>{f}</option>))}
                        </select>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-800">Colors</div>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            <label className="text-xs text-gray-600">Heading
                                <input type="color" value={headingColor} onChange={(e)=> setHeadingColor(e.target.value)} className="w-full h-6 border rounded mt-1" />
                            </label>
                            <label className="text-xs text-gray-600">Body
                                <input type="color" value={bodyColor} onChange={(e)=> setBodyColor(e.target.value)} className="w-full h-6 border rounded mt-1" />
                            </label>
                            <label className="text-xs text-gray-600">CTA text
                                <input type="color" value={ctaColor} onChange={(e)=> setCtaColor(e.target.value)} className="w-full h-6 border rounded mt-1" />
                            </label>
                            <label className="text-xs text-gray-600">Accent
                                <input type="color" value={accent} onChange={(e)=> setAccent(e.target.value)} className="w-full h-6 border rounded mt-1" />
                            </label>
                        </div>
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-800 mb-1">Copy</div>
                        <div className="space-y-2">
                            <input value={copy?.heading || ''} onChange={(e)=> setCopy({ ...(copy || { heading:'', subtext:'', cta:'' }), heading: e.target.value })} placeholder="Headline" className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
                            <input value={copy?.subtext || ''} onChange={(e)=> setCopy({ ...(copy || { heading:'', subtext:'', cta:'' }), subtext: e.target.value })} placeholder="Subtext" className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
                            <input value={copy?.cta || ''} onChange={(e)=> setCopy({ ...(copy || { heading:'', subtext:'', cta:'' }), cta: e.target.value })} placeholder="Button label" className="w-full border border-gray-200 rounded-md px-2 py-1 text-sm" />
                        </div>
                    </div>
                </div>
            </aside>

            <section className="col-span-6 h-full overflow-auto p-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-800">Preview</div>
                    <div className="flex items-center gap-1">
                        {SIZES.map(s => (
                            <button key={s.key} onClick={()=> setSizeKey(s.key as any)} className={`px-2 py-1.5 text-xs rounded-md border ${sizeKey===s.key ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white hover:bg-gray-50'}`}>{s.key}</button>
                        ))}
                    </div>
                </div>
                {(() => {
                    const s = SIZES.find(x => x.key === sizeKey) || SIZES[0];
                    const headingStyle: React.CSSProperties = { color: headingColor, fontFamily: `'${font}', Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif` };
                    const bodyStyle: React.CSSProperties = { color: bodyColor, fontFamily: `'${font}', Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif` };
                    const ctaStyle: React.CSSProperties = { color: ctaColor, fontFamily: `'${font}', Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif` };
                    return (
                        <div className="border border-gray-200 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-2">{s.label}</div>
                            <div className="flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden" style={{width: s.w, height: s.h}}>
                                <div className="relative" style={{width: s.w, height: s.h}}>
                                    {images[activeImage] && <img src={images[activeImage]} className="absolute inset-0 w-full h-full object-cover" alt="bg" />}
                                    {template === 'overlay' && (<div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/35" />)}

                                    {template === 'text-panel' && (
                                        <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-gray-200 p-2" style={{color: bodyStyle.color, fontFamily: bodyStyle.fontFamily}}>
                                            <div className="font-extrabold leading-tight" style={{...headingStyle, fontSize: Math.max(12, Math.min(24, Math.round(s.h*0.16)))}}>{copy?.heading || 'Special Offer'}</div>
                                            <div className="opacity-80" style={{...bodyStyle, fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                            <div>
                                                <button className="mt-1 px-2 py-1 rounded-full font-bold" style={{background: accent, ...ctaStyle, fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                            </div>
                                            {logo && <img src={logo} className="absolute top-2 right-2 h-5 w-auto object-contain" alt="logo" />}
                                        </div>
                                    )}

                                    {template === 'split' && (
                                        <div className="absolute left-0 top-0 bottom-0 bg-white/95 border-r border-gray-200 p-2" style={{width: Math.round(s.w*0.42), color: bodyStyle.color, fontFamily: bodyStyle.fontFamily}}>
                                            <div className="font-extrabold leading-tight" style={{...headingStyle, fontSize: Math.max(12, Math.min(22, Math.round(s.h*0.14)))}}>{copy?.heading || 'Special Offer'}</div>
                                            <div className="opacity-80" style={{...bodyStyle, fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                            <div>
                                                <button className="mt-1 px-2 py-1 rounded-md font-bold text-white" style={{background: accent, fontSize: Math.max(9, Math.min(13, Math.round(s.h*0.09)))}}>{copy?.cta || 'Book Now'}</button>
                                            </div>
                                            {logo && <img src={logo} className="absolute bottom-2 left-2 h-5 w-auto object-contain" alt="logo" />}
                                        </div>
                                    )}

                                    {template === 'center-hero' && (
                                        <>
                                            <div className="absolute inset-0" style={{background:'linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55))'}} />
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{color: bodyStyle.color, fontFamily: bodyStyle.fontFamily}}>
                                                <div className="tracking-wide" style={{...headingStyle, fontSize: Math.max(14, Math.min(28, Math.round(s.h*0.18))), fontWeight:800}}>{copy?.heading || 'Feels Like Home'}</div>
                                                <div className="mt-1 opacity-95" style={{...bodyStyle, fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Book direct for perks'}</div>
                                                <button className="mt-2 px-2 py-1 rounded-md font-bold" style={{border:`2px solid ${accent}`, background:'transparent', ...ctaStyle, fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                            </div>
                                            {logo && <img src={logo} className="absolute top-2 right-2 h-5 w-auto object-contain" alt="logo" />}
                                        </>
                                    )}

                                    {template === 'overlay' && (
                                        <div className="absolute inset-0 flex flex-col justify-end p-2 text-white" style={{color: bodyStyle.color, fontFamily: bodyStyle.fontFamily}}>
                                            <div className="font-extrabold leading-tight" style={{...headingStyle, fontSize: Math.max(12, Math.min(24, Math.round(s.h*0.16)))}}>{copy?.heading || 'Special Offer'}</div>
                                            <div className="opacity-95" style={{...bodyStyle, fontSize: Math.max(10, Math.min(16, Math.round(s.h*0.11)))}}>{copy?.subtext || 'Save on your next stay when you book direct.'}</div>
                                            <div>
                                                <button className="mt-1 px-2 py-1 rounded-full text-white font-bold" style={{ background: accent, fontSize: Math.max(9, Math.min(14, Math.round(s.h*0.1)))}}>{copy?.cta || 'Book Now'}</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-2 flex justify-end gap-2">
                                <button onClick={() => {
                                    const usedCopy = copy || { heading: 'Special Offer', subtext: 'Save on your next stay when you book direct.', cta: 'Book Now' };
                                    const name = `Banner ${new Date().toLocaleString()}`;
                                    { const s = SIZES.find(x => x.key === sizeKey) || SIZES[0]; onSaveBanner({ name, prompt, images, logo, copy: usedCopy, template, accent, sizeKey, width: s.w, height: s.h }); }
                                    setJustSaved(true);
                                    setTimeout(()=> setJustSaved(false), 1500);
                                }} className="text-xs px-3 py-1.5 rounded-md border">Save to library</button>
                                {justSaved && <span className="text-[11px] text-green-600">Saved</span>}
                                <button onClick={exportOg} className="text-xs px-3 py-1.5 rounded-md border">Export OG image</button>
                            </div>
                        </div>
                    );
                })()}
            </section>

            <aside className="col-span-3 h-full overflow-auto border-l border-gray-200 p-3">
                <div className="text-sm font-semibold text-gray-800 mb-2">Saved banners</div>
                <div className="space-y-2">
                    {bannerPresets?.length === 0 && (
                        <div className="text-xs text-gray-500">No saved banners yet.</div>
                    )}
                    {bannerPresets?.map(p => (
                        <button key={p.id} onClick={()=> { setPrompt(p.prompt || ''); setImages(p.images || []); setActiveImage(0); setLogo(p.logo || null); setCopy(p.copy || null as any); applyTemplate(p.template as any); setAccent(p.accent); if ((p as any).sizeKey) setSizeKey((p as any).sizeKey as any); }} className="w-full border rounded-md bg-white hover:shadow text-left">
                            <div className="relative bg-gray-50 rounded-t-md overflow-hidden" style={{aspectRatio: (p as any).width && (p as any).height ? `${(p as any).width}/${(p as any).height}` : (p.sizeKey==='336x280'?'336/280': p.sizeKey==='728x90'?'728/90': p.sizeKey==='300x600'?'300/600': p.sizeKey==='320x100'?'320/100':'300/250')}}>
                                {p.images?.[0] && <img src={p.images[0]} className="absolute inset-0 w-full h-full object-cover" alt={p.name} />}
                                {(p.template === 'overlay' || p.template === 'center-hero') && (<div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/35" />)}
                                <div className="absolute inset-0 flex flex-col justify-end p-2 text-white">
                                    <div className="font-bold text-[12px] truncate">{p.copy?.heading}</div>
                                    <div className="opacity-90 text-[11px] truncate">{p.copy?.subtext}</div>
                                </div>
                                {p.logo && <img src={p.logo} className="absolute top-2 right-2 h-4 w-auto object-contain" alt="logo" />}
                                <div className="absolute top-1 left-1 bg-white/90 text-[10px] px-1 py-0.5 rounded border">{(p as any).width && (p as any).height ? `${(p as any).width}×${(p as any).height}` : (p.sizeKey || '300x250')}</div>
                            </div>
                            <div className="p-2">
                                <div className="text-xs font-medium text-gray-800 truncate">{p.name}</div>
                                <div className="text-[11px] text-gray-500 truncate">{p.template}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>
        </div>
    );
};

// ===== Review View =====
const ReviewView = ({ campaigns, onBack }: { campaigns: FullCampaign[]; onBack: () => void }) => {
    return (
        <div className="space-y-4 pb-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-800">4. Review & publish</h2>
                <button onClick={onBack} className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-900"><BackIcon /><span>Back to edit</span></button>
            </div>
            <p className="text-gray-600">Double-check each campaign before launching.</p>
            <div className="space-y-3">
                {campaigns.map(c => (
                    <div key={c.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-sm font-semibold text-gray-800">{c.campaignName}</div>
                                <div className="text-xs text-gray-500">{c.channel} • {c.campaignType} • {c.market.name} �� Lang: {c.languages.join(', ')}</div>
                            </div>
                            <div className="text-xs text-gray-500">Assets: {(c.googleAds?.assetGroups?.length || 0) + (c.googleAds?.adGroups?.length || 0)}</div>
                        </div>
                        {c.channel === 'Google' && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-700">
                                <div>
                                    <div className="font-semibold text-gray-600 mb-1">Asset Groups</div>
                                    <ul className="list-disc ml-4 space-y-0.5">
                                        {(c.googleAds?.assetGroups || []).map(ag => (<li key={ag.id}>{ag.name}</li>))}
                                    </ul>
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-600 mb-1">Ad Groups</div>
                                    <ul className="list-disc ml-4 space-y-0.5">
                                        {(c.googleAds?.adGroups || []).map(g => (<li key={g.id}>{g.name}</li>))}
                                    </ul>
                                </div>
                                <div>
                                    <div className="font-semibold text-gray-600 mb-1">Ads</div>
                                    <ul className="list-disc ml-4 space-y-0.5">
                                        {(((c as any).googleAds || {}).ads || []).map((ad:any) => (<li key={ad.id}>{(ad.headlines?.[0] || ad.finalUrl || 'Ad')}</li>))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="flex justify-end">
                <button className="px-4 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-800">Publish</button>
            </div>
        </div>
    );
};

// ===== MAIN APP COMPONENT =====

const App: React.FC = () => {
    const [view, setView] = useState<View>('input');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [brief, setBrief] = useState("");
    const [summaries, setSummaries] = useState<CampaignSummary[]>([]);
    const [campaigns, setCampaigns] = useState<FullCampaign[]>([]);
    const [topTab, setTopTab] = useState<'campaign' | 'creative'>('campaign');
    const [assetLibrary, setAssetLibrary] = useState<AssetLibrary>(() => {
        try {
            const raw = localStorage.getItem('assetLibrary');
            if (raw) return JSON.parse(raw);
        } catch {}
        return { images: [], logos: [], banners: [] };
    });
    const [selectedGoogleAccountId, setSelectedGoogleAccountId] = useState<string>(GOOGLE_AD_ACCOUNTS[0].id);
    const [libraryPicker, setLibraryPicker] = useState<{ open: boolean; type: 'images'|'logos'; max: number; onSelect: (urls: string[]) => void } | null>(null);
    const [bannerPicker, setBannerPicker] = useState<{ open: boolean; onSelect: (preset: BannerPreset) => void } | null>(null);
    useEffect(() => { try { localStorage.setItem('assetLibrary', JSON.stringify(assetLibrary)); } catch {} }, [assetLibrary]);

    const openLibrary = (type: 'images'|'logos', max: number, onSelect: (urls: string[]) => void) => {
        setLibraryPicker({ open: true, type, max, onSelect });
    };
    const openBanner = (onSelect: (preset: BannerPreset) => void) => {
        setBannerPicker({ open: true, onSelect });
    };

    const handleSaveBannerPreset = (preset: Omit<BannerPreset,'id'|'createdAt'>) => {
        const id = self.crypto.randomUUID();
        const createdAt = Date.now();
        setAssetLibrary(prev => {
            const banners = [{ id, createdAt, ...preset }, ...(prev.banners || [])];
            const images = Array.from(new Set([...(prev.images || []), ...((preset.images)||[])]));
            const logos = preset.logo ? Array.from(new Set([...(prev.logos || []), preset.logo])) : (prev.logos || []);
            return { ...prev, images, logos, banners };
        });
    };

    const handleGenerateSummary = async (prompt: string, channels: Channel[], manualParams?: ManualCampaignConfig, accountId?: string) => {
        setIsLoading(true);
        setError(null);
        setBrief(prompt);
        if (accountId) {
            setSelectedGoogleAccountId(accountId);
        }
        try {
            const result = await generateCampaignSummary(prompt, channels, manualParams);
            setSummaries(result);
            setView('summary');
        } catch (e: any) {
            setError(e.message);
            setView('input');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await generateCampaignDetails(summaries, brief);
            setCampaigns(result);
            setView('details');
        } catch (e: any) {
            setError(e.message);
            setView('summary');
        } finally {
            setIsLoading(false);
        }
    };

    const resetToInput = () => {
        setView('input');
        setSummaries([]);
        setCampaigns([]);
        setBrief("");
    };

    const backToSummary = () => {
        setView('summary');
        setCampaigns([]);
    }

    const LibraryPickerModal = ({ cfg, assets, onClose }: { cfg: { type: 'images'|'logos'; max: number; onSelect: (urls:string[])=>void }, assets: string[], onClose: () => void }) => {
        const [selected, setSelected] = useState<Set<number>>(new Set());
        const toggle = (i:number) => {
            setSelected(prev => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i);
                else if (next.size < cfg.max) next.add(i);
                return next;
            });
        };
        const confirm = () => {
            const urls = Array.from(selected).map(i => assets[i]);
            cfg.onSelect(urls);
            onClose();
        };
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/40" onClick={onClose} />
                <div className="relative bg-white rounded-lg shadow-lg w-[560px] max-w-[92vw] p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-800">{cfg.type === 'images' ? 'Select images' : 'Select logos'}</div>
                        <button onClick={onClose} className="text-sm text-gray-600 hover:text-black">Close</button>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">Selected {Array.from(selected).length} / {cfg.max}</div>
                    <div className="grid grid-cols-5 gap-2 max-h-64 overflow-auto">
                        {assets.map((src, i) => (
                            <button key={i} onClick={() => toggle(i)} className={`relative border rounded-md overflow-hidden ${selected.has(i) ? 'ring-2 ring-blue-500' : ''}`}>
                                <img src={src} alt={`${cfg.type} ${i+1}`} className="w-full h-20 object-cover" />
                            </button>
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                        <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
                        <button onClick={confirm} className="px-3 py-1.5 text-xs rounded-md bg-black text-white">Add selected</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center text-center p-8 rounded-lg min-h-[300px]">
                    <SpinnerIcon className="h-12 w-12 text-blue-600"/>
                    <h3 className="mt-4 text-xl font-semibold text-gray-700">Generating...</h3>
                    <p className="mt-1 text-gray-500">The AI is building your campaign plan. This may take a moment.</p>
                </div>
            );
        }

        switch (view) {
            case 'input':
                return <InputView onGenerate={handleGenerateSummary} googleAccounts={GOOGLE_AD_ACCOUNTS} selectedAccountId={selectedGoogleAccountId} onSelectAccount={setSelectedGoogleAccountId} />;
            case 'summary':
                return <CampaignSummaryTable summaries={summaries} onSelect={() => {}} onConfirm={handleGenerateDetails} onBack={resetToInput} onUpdate={(id, updater) => setSummaries(prev => prev.map(s => s.id === id ? updater(s) : s))} />;
            case 'details':
                return <DetailsView campaigns={campaigns} setCampaigns={setCampaigns} brief={brief} onBack={backToSummary} onReview={() => setView('review')} openLibrary={openLibrary} goToCreative={() => setTopTab('creative')} openBanner={openBanner} />;
            case 'review':
                return <ReviewView campaigns={campaigns} onBack={() => setView('details')} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header topTab={topTab} setTopTab={setTopTab} />
            <main className={view==='details' ? 'w-full p-0 md:p-0' : 'max-w-6xl mx-auto p-4 md:p-8'}>
                <div className="mb-4" />
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6 flex items-start" role="alert">
                        <ErrorIcon/>
                        <div className="ml-3">
                            <strong className="font-bold">An error occurred:</strong>
                            <span className="block sm:inline ml-2">{error}</span>
                        </div>
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
                            <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </span>
                    </div>
                )}
                {topTab === 'creative' ? (
                    <CreativeGeneratorView onSaveBanner={handleSaveBannerPreset} onPickFromLibrary={openLibrary} bannerPresets={assetLibrary.banners || []} />
                ) : (
                    renderContent()
                )}
                {libraryPicker?.open && (
                    <LibraryPickerModal
                        cfg={{ type: libraryPicker.type, max: libraryPicker.max, onSelect: libraryPicker.onSelect }}
                        assets={libraryPicker.type === 'images' ? (assetLibrary.images || []) : (assetLibrary.logos || [])}
                        onClose={() => setLibraryPicker(null)}
                    />
                )}
                {bannerPicker?.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setBannerPicker(null)} />
                        <div className="relative bg-white rounded-lg shadow-lg w-[720px] max-w-[95vw] p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-800">Select banner preset</div>
                                <button onClick={() => setBannerPicker(null)} className="text-sm text-gray-600 hover:text-black">Close</button>
                            </div>
                            <div className="grid grid-cols-3 gap-3 max-h-80 overflow-auto">
                                {(assetLibrary.banners || []).length === 0 && (
                                    <div className="col-span-3 text-xs text-gray-500">No saved banners yet.</div>
                                )}
                                {(assetLibrary.banners || []).map((p) => (
                                    <button key={p.id} onClick={()=> { bannerPicker.onSelect(p); setBannerPicker(null); }} className="border rounded-md overflow-hidden text-left hover:shadow">
                                        <div className="relative h-28 bg-gray-50">
                                            {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="absolute inset-0 w-full h-full object-cover"/>}
                                            {p.template !== 'text-panel' && p.template !== 'split' && p.template !== 'outline' && p.template !== 'stripe' && p.template !== 'glass' && p.template !== 'arch' && p.template !== 'center-hero' && (<div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/35" />)}
                                            {p.template === 'text-panel' && (
                                                <div className="absolute inset-x-0 bottom-0 bg-white/95 border-t border-gray-200 p-2 text-gray-900">
                                                    <div className="font-bold text-[12px] truncate">{p.copy?.heading}</div>
                                                    <div className="opacity-80 text-[11px] truncate">{p.copy?.subtext}</div>
                                                </div>
                                            )}
                                            {p.template === 'split' && (
                                                <div className="absolute left-0 top-0 bottom-0 bg-white/95 border-r border-gray-200 p-2 text-gray-900 w-[46%]">
                                                    <div className="font-bold text-[12px] truncate">{p.copy?.heading}</div>
                                                    <div className="opacity-80 text-[11px] truncate">{p.copy?.subtext}</div>
                                                </div>
                                            )}
                                            {(p.template === 'overlay' || p.template === 'logo-badge') && (
                                                <div className="absolute inset-0 flex flex-col justify-end p-2 text-white">
                                                    <div className="font-bold text-[12px] truncate">{p.copy?.heading}</div>
                                                    <div className="opacity-90 text-[11px] truncate">{p.copy?.subtext}</div>
                                                </div>
                                            )}
                                            {p.logo && <img src={p.logo} className="absolute top-2 right-2 h-4 w-auto object-contain" alt="logo" />}
                                        </div>
                                        <div className="p-2">
                                            <div className="text-xs font-medium text-gray-800 truncate">{p.name}</div>
                                            <div className="text-[11px] text-gray-500 truncate">{p.template}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};


// Advanced assignment dropdown component
const AdvancedAssignDropdown = ({ ad, googleAdGroups, currentCombos, onAssignPlan, onAssignExternal, onUnassign }: { ad: any, googleAdGroups: {id:string; name:string}[], currentCombos: { campaignId:string; campaignName:string; adGroupId:string; adGroupName:string }[], onAssignPlan: (adGroupId:string)=>void, onAssignExternal: (campaignName:string, adGroupName:string)=>void, onUnassign: ()=>void }) => {
    const [open, setOpen] = useState(false);
    // Mock existing campaigns/ad groups from Google Ads account
    const mockExisting = [
        { campaignName: '[UG]-Brand-USA', adGroups: ['Brand Exact', 'Brand Phrase'] },
        { campaignName: '[UG]-Remarketing-ALL', adGroups: ['All Visitors 30d', 'Cart Abandoners 14d'] },
        { campaignName: '[UG]-Hotel-EN', adGroups: ['Hotel Brand EN', 'Generic Hotel EN'] },
        { campaignName: '[UG]-PMax-Core', adGroups: ['Asset Group A', 'Asset Group B'] },
    ];

    const assignedCount = (ad.assignedTargets?.length || 0) + (ad.assignedAdGroupId ? 1 : 0) + (ad.assignedExternal ? 1 : 0);

    const hasExternal = (cName: string, gName: string) => (ad.assignedTargets || []).some((t:any)=> t.source==='external' && t.campaignName===cName && t.adGroupName===gName);
    const toggleExternal = (cName: string, gName: string) => {
        if (hasExternal(cName, gName)) {
            const remain = (ad.assignedTargets || []).filter((t:any)=> !(t.source==='external' && t.campaignName===cName && t.adGroupName===gName));
            onUnassign();
            remain.filter((x:any)=> x.source==='plan' && x.adGroupId).forEach((x:any)=> onAssignPlan(x.adGroupId));
            remain.filter((x:any)=> x.source==='external').forEach((x:any)=> onAssignExternal(x.campaignName, x.adGroupName));
        } else {
            onAssignExternal(cName, gName);
        }
    };

    const isCheckedPlan = (id: string) => {
        if (ad.assignedAdGroupId === id) return true;
        return (ad.assignedTargets || []).some((t: any) => t.source === 'plan' && t.adGroupId === id);
    };
    const togglePlan = (id: string) => {
        if (isCheckedPlan(id)) {
            // remove from assignedTargets or legacy field
            const remain = (ad.assignedTargets || []).filter((t: any) => !(t.source === 'plan' && t.adGroupId === id));
            if (ad.assignedAdGroupId === id) onUnassign();
            else onAssignExternal('', ''); // no-op to trigger state path existence
            // Update via onAssignPlan with null is not available; use onUnassign + re-add others via onAssignExternal path handled above.
        } else {
            onAssignPlan(id);
        }
    };

    const currentPlanGroups = [
        ...googleAdGroups.map(g => ({ scope: 'this' as const, id: g.id, label: `This campaign / ${g.name}` })),
        ...currentCombos.filter(c => !googleAdGroups.some(g => g.id === c.adGroupId)).map(c => ({ scope: 'other' as const, id: c.adGroupId, label: `${c.campaignName} / ${c.adGroupName}` })),
    ];

    return (
        <div className="relative inline-block">
            <button onClick={() => setOpen(v=>!v)} className="text-xs px-2 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-50">
                Assign{assignedCount ? ` (${assignedCount})` : ''}
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-[340px] bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20">
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">Current plan</div>
                    <div className="max-h-40 overflow-auto mb-2 space-y-1">
                        {currentPlanGroups.length === 0 && (
                            <div className="text-xs text-gray-400">No ad groups available</div>
                        )}
                        {currentPlanGroups.map(item => (
                            <label key={item.id} className="flex items-center gap-2 text-sm px-2 py-1 rounded-md hover:bg-gray-50 cursor-pointer">
                                <input type="checkbox" className="h-3.5 w-3.5" checked={isCheckedPlan(item.id)} onChange={() => togglePlan(item.id)} />
                                <span>{item.label}</span>
                            </label>
                        ))}
                    </div>
                    <div className="border-t border-gray-100 pt-2 mt-2" />
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">Existing account</div>
                    <div className="max-h-48 overflow-auto space-y-2 pr-1">
                        {mockExisting.map((mc, i) => (
                            <div key={i} className="border border-gray-100 rounded-md">
                                <div className="px-2 py-1 text-xs font-semibold text-gray-700">{mc.campaignName}</div>
                                <div className="px-2 pb-2 space-y-1">
                                    {mc.adGroups.map((g, j) => (
                                        <label key={j} className="flex items-center gap-2 text-sm px-2 py-1 rounded-md hover:bg-gray-50 cursor-pointer">
                                            <input type="checkbox" className="h-3.5 w-3.5" checked={hasExternal(mc.campaignName, g)} onChange={()=> toggleExternal(mc.campaignName, g)} />
                                            <span>{g}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                        <button onClick={() => { onUnassign(); }} className="text-xs text-gray-600 hover:text-gray-900">Unassign all</button>
                        <button onClick={() => setOpen(false)} className="text-xs px-2 py-1 rounded-md bg-black text-white">Done</button>
                    </div>
                    <div className="flex justify-end mt-2"><button onClick={()=> setOpen(false)} className="text-xs px-2 py-1 rounded-md border">Done</button></div>
                </div>
            )}
        </div>
    );
};

export default App;
