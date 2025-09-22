import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FullCampaign, CampaignSummary, AssetGroup, AdGroup, Ad, Channel, MetaAdSet, TikTokAdGroup, MetaAd, TikTokAd, Market } from "./types";
import { generateCampaignSummary, generateCampaignDetails, generateCreativeAsset, AssetType, generateGoogleAdGroup, generateGoogleSearchAd } from "./services/geminiService";

type View = 'input' | 'summary' | 'details';
type SortConfig = { key: keyof CampaignSummary | 'browserLangs'; direction: 'ascending' | 'descending' } | null;
type InputMode = 'prompt' | 'manual';

const ALL_CAMPAIGN_TYPES = ["PMax", "Brand", "Retargeting", "Hotel Ads"];
const COUNTRIES: Omit<Market, 'browserLangs'>[] = [
    { name: "United States", iso: "US"}, { name: "United Kingdom", iso: "GB"},
    { name: "Germany", iso: "DE"}, { name: "France", iso: "FR"},
    { name: "Canada", iso: "CA"}, { name: "Australia", iso: "AU"},
    { name: "Japan", iso: "JP"}, { name: "India", iso: "IN"},
    { name: "Brazil", iso: "BR"}, { name: "Mexico", iso: "MX"},
    { name: "Spain", iso: "ES"}, { name: "Italy", iso: "IT"},
    { name: "Netherlands", iso: "NL"}, { name: "Sweden", iso: "SE"},
    { name: "Switzerland", iso: "CH"}, { name: "Norway", iso: "NO"},
    { name: "Denmark", iso: "DK"}, { name: "Finland", iso: "FI"},
    { name: "Austria", iso: "AT"}, { name: "Belgium", iso: "BE"},
    { name: "Ireland", iso: "IE"}, { name: "New Zealand", iso: "NZ"},
    { name: "Singapore", iso: "SG"}, { name: "Hong Kong", iso: "HK"}
].sort((a,b) => a.name.localeCompare(b.name));

const getMarketWithLangs = (country: Omit<Market, 'browserLangs'>): Market => {
    // This is a simplified mapping. A real app would have a more comprehensive logic.
    const langMap: Record<string, string[]> = {
        US: ['en-US'], GB: ['en-GB'], DE: ['de-DE'], FR: ['fr-FR'],
        CA: ['en-CA', 'fr-CA'], AU: ['en-AU'], JP: ['ja-JP'], IN: ['en-IN', 'hi-IN'],
        BR: ['pt-BR'], MX: ['es-MX'], ES: ['es-ES'], IT: ['it-IT'],
        NL: ['nl-NL'], SE: ['sv-SE'], CH: ['de-CH', 'fr-CH', 'it-CH'],
        NO: ['no-NO'], DK: ['da-DK'], FI: ['fi-FI'], AT: ['de-AT'],
        BE: ['nl-BE', 'fr-BE'], IE: ['en-IE'], NZ: ['en-NZ'], SG: ['en-SG'],
        HK: ['en-HK', 'zh-HK']
    };
    return { ...country, browserLangs: langMap[country.iso] || [] };
};


// ===== ICONS =====
const TiktokIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.05-4.84-.95-6.43-2.88-1.59-1.93-2.02-4.35-1.1-6.58.92-2.23 3.12-3.82 5.5-4.04 1.45-.14 2.9-.03 4.33.22v4.22c-1.43-.24-2.86-.1-4.25.31-.9.27-1.78.69-2.59 1.23-.23.15-.44.32-.66.51-.3.25-.53.53-.74.83-.49.69-.78 1.52-.83 2.39-.05.87.16 1.76.6 2.55.43.79 1.09 1.46 1.9 1.87.81.41 1.72.58 2.62.53 1.14-.06 2.25-.45 3.18-1.11.93-.66 1.6-1.59 1.94-2.66.21-.69.3-1.42.3-2.14s.01-6.19.01-9.28c.01-1.3-.01-2.59.01-3.89.01-.13.08-.26.19-.33.21-.13.43-.23.66-.31.2-.07.4-.12.6-.19.28-.09.56-.2.84-.29.14-.05.28-.09.42-.14.28-.1.56-.2.83-.31v-4.2z"></path></svg>;
const MetaIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"><path d="M22.09,18.84,20.25,22a.75.75,0,0,1-1-.44L16.45,15.5,12,19V5l4.45-3.5,2.8,6.06a.75.75,0,0,1-1,.44L16,6.53,13.5,9.85l3.65,7.89L18.89,14a.75.75,0,0,1,1,.44l2.21,4.42ZM3.91,18.84,5.75,22a.75.75,0,0,0,1-.44L9.55,15.5,12,19V5L7.55,1.5,4.75,7.56a.75.75,0,0,0,1,.44L8,6.53,10.5,9.85,6.85,17.74,5.11,14a.75.75,0,0,0-1-.44L1.9,18.84Z"></path></svg>;
const GoogleIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path></svg>;
const SparklesIcon = ({className = "w-5 h-5"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L9.27 9.27L3 12l6.27 2.73L12 21l2.73-6.27L21 12l-6.27-2.73L12 3z"/><path d="M5 8l1.5 3.5L10 13l-3.5 1.5L5 18"/><path d="M14 6l1.5 3.5L19 11l-3.5 1.5L14 16"/></svg>;
const ErrorIcon = () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const SpinnerIcon = ({className = "h-5 w-5 text-white"}) => <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>;
const PlusIcon = ({className = "w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const TrashIcon = ({className = "w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const EditIcon = ({className="w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const BackIcon = ({className="w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const ChevronDownIcon = ({className="w-4 h-4"}) => <svg width="16" height="16" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;

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


const channelIconSrc: Record<string, string> = {
    Google: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2F533ea53c28d34716a117391b4d019fab?format=webp&width=800',
    Meta: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2F6d64048564434594b3d94470b48f7f90?format=webp&width=800',
    TikTok: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2F7f6f42d403b0493d9a24bfa1923d7754?format=webp&width=800',
    Bing: 'https://cdn.builder.io/api/v1/image/assets%2Fc0fd0d6879d745f581077638ce903418%2F217a72f512e44b679bcb89421e851a42?format=webp&width=800',
};
const channelIcons: Record<Channel, React.ReactNode> = {
    Google: <img src={channelIconSrc.Google} className="h-5 w-auto object-contain" alt="Google Ads" />,
    Meta: <img src={channelIconSrc.Meta} className="h-5 w-auto object-contain" alt="Meta" />,
    TikTok: <img src={channelIconSrc.TikTok} className="h-5 w-auto object-contain" alt="TikTok" />,
};

// ===== UI COMPONENTS =====

const Header = () => (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 p-4 border-b border-gray-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                    <SparklesIcon className="w-6 h-6 text-white"/>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Campaign Generator</h1>
            </div>
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

const CollapsibleCard = ({ title, onUpdateTitle, onDelete, children }: { title: string, onUpdateTitle: (newTitle: string) => void, onDelete: () => void, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
                <div className="flex-grow mr-4">
                    <EditableField value={title} onSave={onUpdateTitle} />
                </div>
                <div className="flex items-center space-x-2">
                    <IconButton onClick={onDelete} icon={<TrashIcon />} className="text-red-500 hover:bg-red-100" />
                    <IconButton onClick={() => setIsOpen(!isOpen)} icon={<ChevronDownIcon className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />} className="text-gray-500 hover:bg-gray-200" />
                </div>
            </div>
            {isOpen && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
};

// ===== Channel-Specific Detail Components =====

const GoogleCampaignDetails = ({ campaign, allCampaigns, brief, onUpdate, onAdd, onDelete, onGenerate, onRewrite }: { campaign: FullCampaign, allCampaigns: FullCampaign[], brief: string, onUpdate: (path: (string | number)[], value: any) => void, onAdd: (path: (string | number)[], value: any) => void, onDelete: (path: (string | number)[]) => void, onGenerate: (assetType: AssetType, existing: string[]) => Promise<string>, onRewrite: (assetType: AssetType, existing: string[], toRewrite: string) => Promise<string> }) => {
    const { googleAds } = campaign;
    if (!googleAds) return null;

    const [creatingGroup, setCreatingGroup] = useState(false);
    const [creatingAd, setCreatingAd] = useState(false);
    const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
    const isPMax = /pmax|performance\s*max|hotel/i.test(campaign.campaignType);

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
        <>
            {googleAds.assetGroups && googleAds.assetGroups.length > 0 && (
                <div className="flex items-center justify-between py-2">
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
                    <EditableList title="Headlines" items={ag.headlines} assetType="headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'headlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'headlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'headlines', i])} onGenerate={(e) => onGenerate('headline', e)} onRewrite={(e, r) => onRewrite('headline', e, r)} />
                    <EditableList title="Long Headlines" items={ag.longHeadlines} assetType="long headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'longHeadlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i])} onGenerate={(e) => onGenerate('long headline', e)} onRewrite={(e, r) => onRewrite('long headline', e, r)} />
                    <EditableList title="Descriptions" items={ag.descriptions} assetType="description" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'descriptions', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'descriptions'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'descriptions', i])} onGenerate={(e) => onGenerate('description', e)} onRewrite={(e, r) => onRewrite('description', e, r)} />
                </CollapsibleCard>
            ))}

            { !isPMax && (
            <>
            <div className="flex items-center justify-between py-2">
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
                    <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs text-gray-600">Assign to Campaign</label>
                        <select
                            value={(adg as any).assignedCampaignName || campaign.campaignName}
                            onChange={(e) => onUpdate(['googleAds','adGroups', adgIndex, 'assignedCampaignName'], e.target.value)}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1"
                        >
                            <option value="">Unassigned</option>
                            <option value={campaign.campaignName}>{campaign.campaignName}</option>
                        </select>
                        <div className="ml-auto text-xs text-gray-500">Assigned Ads: {(googleAds as any).ads ? ((googleAds as any).ads as any[]).filter(a => (a.assignedTargets || []).some((t:any)=> t.source==='plan' && t.adGroupId===adg.id) || a.assignedAdGroupId === adg.id).length : 0}</div>
                    </div>
                </CollapsibleCard>
            ))}

            <div className="flex items-center justify-between py-2">
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

            {((googleAds as any).ads || []).map((ad: any, adIndex: number) => {
                const expanded = expandedAdId === ad.id;
                return (
                <div key={ad.id} className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4">
                    <div className="flex items-center gap-2 p-3 border-b border-gray-100">
                        <button onClick={() => setExpandedAdId(expanded ? null : ad.id)} className="text-xs font-medium text-gray-700 hover:text-gray-900">
                            {expanded ? '▾' : '▸'} Ad {adIndex + 1}
                        </button>
                        <div className="text-xs text-gray-500 truncate max-w-[50%]">{ad.headlines?.[0] || ad.finalUrl || 'New Ad'}</div>
                        <div className="ml-auto relative">
                            <AdvancedAssignDropdown
                                ad={ad}
                                googleAdGroups={googleAds.adGroups || []}
                                currentCombos={currentPlanCombos}
                                onAssignPlan={(adGroupId) => {
                                    const existing = (ad.assignedTargets || []).filter((t:any)=> !(t.source==='plan' && t.adGroupId===adGroupId));
                                    onUpdate(['googleAds','ads', adIndex, 'assignedTargets'], [...existing, { source:'plan', adGroupId }]);
                                }}
                                onAssignExternal={(campaignName, adGroupName) => {
                                    const existing = (ad.assignedTargets || []).filter((t:any)=> !(t.source==='external' && t.campaignName===campaignName && t.adGroupName===adGroupName));
                                    onUpdate(['googleAds','ads', adIndex, 'assignedTargets'], [...existing, { source:'external', campaignName, adGroupName }]);
                                }}
                                onUnassign={() => { onUpdate(['googleAds','ads', adIndex, 'assignedTargets'], []); onUpdate(['googleAds','ads', adIndex, 'assignedAdGroupId'], null); onUpdate(['googleAds','ads', adIndex, 'assignedExternal'], null); }}
                            />
                            <IconButton onClick={() => onDelete(['googleAds','ads', adIndex])} icon={<TrashIcon className="w-4 h-4"/>} className="text-red-500 hover:bg-red-100 inline-flex ml-2" />
                        </div>
                    </div>
                    {expanded && (
                    <div className="p-4">
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
                        <EditableField value={ad.finalUrl} onSave={(newValue) => onUpdate(['googleAds', 'ads', adIndex, 'finalUrl'], newValue)} fieldType="url" />
                        <EditableList title={`Headlines (${ad.headlines?.length || 0}/15)`} items={ad.headlines} assetType="headline" onUpdate={(i, v) => onUpdate(['googleAds', 'ads', adIndex, 'headlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'ads', adIndex, 'headlines'], v)} onDelete={(i) => onDelete(['googleAds', 'ads', adIndex, 'headlines', i])} onGenerate={(e) => onGenerate('headline', e)} onRewrite={(e, r) => onRewrite('headline', e, r)} />
                        <EditableList title={`Descriptions (${ad.descriptions?.length || 0}/4)`} items={ad.descriptions} assetType="description" onUpdate={(i, v) => onUpdate(['googleAds', 'ads', adIndex, 'descriptions', i], v)} onAdd={(v) => onAdd(['googleAds', 'ads', adIndex, 'descriptions'], v)} onDelete={(i) => onDelete(['googleAds', 'ads', adIndex, 'descriptions', i])} onGenerate={(e) => onGenerate('description', e)} onRewrite={(e, r) => onRewrite('description', e, r)} />
                        <div className="mt-3">
                            <h4 className="text-sm font-semibold text-gray-600 mb-1">Keywords ({(ad.keywords?.length || 0)})</h4>
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
                        </div>
                    </div>
                    )}
                </div>
                );
            })}
            </>) }
        </>
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

const MultiSelectDropdown = ({ label, options, selectedOptions, onToggle }: { label: string, options: string[], selectedOptions: string[], onToggle: (option: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return options.filter(o => o.toLowerCase().includes(q));
    }, [options, query]);

    const visibleSelected = selectedOptions.slice(0, 2);
    const extraCount = Math.max(0, selectedOptions.length - visibleSelected.length);

    return (
        <div ref={containerRef} className="max-w-md">
             <label className="text-sm font-medium text-gray-700">{label}</label>
             <div className="relative mt-1">
                <button onClick={() => setIsOpen(!isOpen)} className="w-full h-10 px-2 border border-gray-200 rounded-lg flex justify-between items-center text-left">
                    <div className="flex flex-wrap gap-1.5 items-center">
                        {selectedOptions.length > 0 ? (
                            <>
                                {visibleSelected.map(option => (
                                    <span key={option} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                                        {option}
                                    </span>
                                ))}
                                {extraCount > 0 && (
                                    <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">+{extraCount}</span>
                                )}
                            </>
                        ) : (
                            <span className="text-gray-500 text-sm">Select campaign types...</span>
                        )}
                    </div>
                    <ChevronDownIcon className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="absolute z-[1000] mt-1 w-[300px] sm:w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-lg shadow-lg">
                        <div className="p-2 border-b border-gray-100">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search types"
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md"
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {filtered.length === 0 ? (
                                <div className="col-span-2 text-xs text-gray-500 px-2 py-1.5">No matches</div>
                            ) : (
                                filtered.map(option => {
                                    const active = selectedOptions.includes(option);
                                    return (
                                        <button
                                            type="button"
                                            key={option}
                                            onClick={() => onToggle(option)}
                                            className={`flex items-center justify-between w-full text-sm px-2 py-1.5 rounded-md border ${active ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-gray-200 text-gray-700'} hover:bg-gray-50`}
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
                        <div className="flex items-center justify-between gap-2 p-2 border-t border-gray-100">
                            <button onClick={() => options.forEach(o => !selectedOptions.includes(o) && onToggle(o))} className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200">Select All</button>
                            <button onClick={() => selectedOptions.forEach(o => onToggle(o))} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">Clear</button>
                            <button onClick={() => setIsOpen(false)} className="ml-auto text-xs px-2 py-1 rounded-full bg-black text-white hover:bg-gray-800">Done</button>
                        </div>
                    </div>
                )}
             </div>
        </div>
    )
}

// ===== Markets data and helpers =====
const MARKETS: { code: string; name: string }[] = [
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "PT", name: "Portugal" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "DK", name: "Denmark" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "AE", name: "UAE" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "GB", name: "UK" },
  { code: "IE", name: "Ireland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" }
];
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

type MarketItem = { type: 'single' | 'cluster'; name: string; codes: string[] };

const InputView = ({ onGenerate }: { onGenerate: (prompt: string, channels: Channel[], manualParams?: { primaryMarkets: Market[]; secondaryMarkets: Market[]; campaignTypes: string[]; }) => void }) => {
    const [brief, setBrief] = useState("");
    const [selectedChannels, setSelectedChannels] = useState<Channel[]>(['Google']);
    const [showMarkets, setShowMarkets] = useState(false);
    const [showUpload, setShowUpload] = useState(false);

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
    const [selectedMarkets, setSelectedMarkets] = useState<Market[]>([]);

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

    const handleToggleChannel = (channel: Channel) => {
        setSelectedChannels(prev =>
            prev.includes(channel)
                ? prev.filter(c => c !== channel)
                : [...prev, channel]
        );
    };

    const handleGenerate = () => {
        if (!brief.trim() || !hasKey) return;
        const singles = marketItems.filter(i => i.type === 'single');
        const clusters = marketItems.filter(i => i.type === 'cluster');
        const primaryMarkets: Market[] = singles.map(i => {
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
        const manual = (primaryMarkets.length || secondaryMarkets.length) ? { primaryMarkets, secondaryMarkets, campaignTypes: [] as string[] } : undefined;
        onGenerate(brief, selectedChannels, manual);
    };

    const isGenerateDisabled = !brief.trim() || selectedChannels.length === 0 || !hasKey;

    return (
        <div className="flex justify-center items-start pt-16 sm:pt-24">
            <div className="w-full max-w-2xl space-y-6">
                <div className="text-center">
                    <h2 className="text-lg font-medium text-gray-800 mb-6">What campaign you would like to launch</h2>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="p-4 pb-3">
                        <div className="mb-4">
                            <textarea
                                value={brief}
                                onChange={(e) => setBrief(e.target.value)}
                                className="w-full h-20 p-3 border-0 rounded-lg focus:ring-0 resize-none text-gray-800 placeholder-gray-500 text-base"
                                placeholder="Enter a task"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setShowMarkets(v=>!v)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 19 20" fill="none">
                                        <path d="M6.33913 10.6787H11.7386C11.6566 12.503 11.2521 14.1831 10.678 15.4135C10.3555 16.1065 10.0076 16.5958 9.68518 16.8956C9.36839 17.1926 9.1506 17.2407 9.03746 17.2407C8.92433 17.2407 8.70654 17.1926 8.38975 16.8956C8.06731 16.5958 7.71941 16.1036 7.39697 15.4135C6.82279 14.1831 6.41832 12.503 6.3363 10.6787H6.33913ZM11.7415 9.32103H6.34196C6.42115 7.49668 6.82562 5.81658 7.39979 4.58621C7.72224 3.89607 8.07014 3.40392 8.39258 3.1041C8.70937 2.80712 8.92716 2.75903 9.04029 2.75903C9.15343 2.75903 9.37122 2.80712 9.68801 3.1041C10.0104 3.40392 10.3583 3.89607 10.6808 4.58621C11.255 5.81658 11.6594 7.49668 11.7415 9.32103ZM13.0991 9.32103C13.0001 6.89988 12.375 4.65126 11.4614 3.17481C14.0664 4.09689 15.9841 6.46995 16.25 9.32103H13.0991ZM16.25 10.6787C15.9841 13.5298 14.0664 15.9028 11.4614 16.8249C12.375 15.3484 13.0001 13.0998 13.0991 10.6787H16.25ZM4.98147 10.6787C5.08047 13.0998 5.70556 15.3484 6.61914 16.8249C4.01415 15.9 2.09646 13.5298 1.83059 10.6787H4.98147ZM1.83059 9.32103C2.09646 6.46995 4.01415 4.09689 6.61914 3.17481C5.70556 4.65126 5.08047 6.89988 4.98147 9.32103H1.83059Z" fill="currentColor"/>
                                    </svg>
                                    Markets
                                </button>
                                {showMarkets && (
                                    <div className="absolute left-0 top-12 w-80 rounded-2xl border bg-white shadow-xl p-3 z-30">
                                        <div className="text-sm font-medium mb-2">Add markets</div>
                                        <input autoFocus value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search countries…" className="w-full rounded-xl border px-3 py-2 text-sm mb-2" />
                                        <div className="max-h-64 overflow-auto space-y-1 pr-1">
                                            {visibleMarkets.length > 0 ? (
                                                visibleMarkets.map(m => (
                                                    <label key={m.code} className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                                        <input type="checkbox" className="h-4 w-4" checked={picked.includes(m.code)} onChange={() => togglePick(m.code)} />
                                                        <span className="flex-1">{m.name}</span>
                                                    </label>
                                                ))
                                            ) : (
                                                <div className="text-xs text-gray-400 p-2">No results</div>
                                            )}
                                        </div>
                                        {(() => { const acts = actionsForSelection(picked, assigned); return (
                                            <>
                                                {acts.showAddMarket && (
                                                    <div className="mt-3"><button onClick={() => { addMarketSingles(picked); setPicked([]); setQ(''); setShowMarkets(false); }} className="px-3 py-2 text-sm rounded-xl border bg-gray-900 text-white w-full">Add market</button></div>
                                                )}
                                                {(acts.showAddMarkets || acts.showAddCluster) && (
                                                    <div className="mt-3 flex gap-2">
                                                        <button onClick={() => { if (acts.showAddMarkets) addMarketSingles(picked); setPicked([]); setQ(''); setShowMarkets(false); }} disabled={!acts.showAddMarkets} className="px-3 py-2 text-sm rounded-xl border bg-gray-900 text-white flex-1 disabled:opacity-40">Add markets</button>
                                                        <button onClick={() => { if (acts.showAddCluster) addMarketCluster(picked); setPicked([]); setQ(''); setShowMarkets(false); }} disabled={!acts.showAddCluster} className="px-3 py-2 text-sm rounded-xl border flex-1 disabled:opacity-40">Add cluster</button>
                                                    </div>
                                                )}
                                            </>
                                        );})()}
                                    </div>
                                )}

                                <input ref={uploadInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
                                <button onClick={() => uploadInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors">
                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
                                        <path d="M4 3C2.89688 3 2 3.89688 2 5V15C2 16.1031 2.89688 17 4 17H10.625C10.1969 16.4062 9.875 15.7281 9.6875 15H4.75C4.47188 15 4.2125 14.8438 4.08437 14.5969C3.95625 14.35 3.975 14.05 4.13438 13.8219L5.88438 11.3219C6.025 11.1219 6.25312 11.0031 6.5 11.0031C6.74688 11.0031 6.975 11.1219 7.11562 11.3219L7.94063 12.5031L9.85938 9.3625C9.99688 9.14063 10.2375 9.00313 10.5 9.00313C10.7625 9.00313 11.0031 9.14063 11.1406 9.3625L11.1469 9.375C12.2406 8.22187 13.7875 7.50313 15.5 7.50313C15.6688 7.50313 15.8344 7.50938 16 7.525V5C16 3.89688 15.1031 3 14 3H4ZM6 5.5C6.82812 5.5 7.5 6.17188 7.5 7C7.5 7.82812 6.82812 8.5 6 8.5C5.17188 8.5 4.5 7.82812 4.5 7C4.5 6.17188 5.17188 5.5 6 5.5ZM15.5 18C17.9844 18 20 15.9844 20 13.5C20 11.0156 17.9844 9 15.5 9C13.0156 9 11 11.0156 11 13.5C11 15.9844 13.0156 18 15.5 18ZM16 11.5V13H17.5C17.775 13 18 13.225 18 13.5C18 13.775 17.775 14 17.5 14H16V15.5C16 15.775 15.775 16 15.5 16C15.225 16 15 15.775 15 15.5V14H13.5C13.225 14 13 13.775 13 13.5C13 13.225 13.225 13 13.5 13H15V11.5C15 11.225 15.225 11 15.5 11C15.775 11 16 11.225 16 11.5Z" fill="currentColor"/>
                                    </svg>
                                    Upload
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <ChannelDropdown selected={selectedChannels[0] || 'Google'} onSelect={(c) => setSelectedChannels([c])} />
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerateDisabled}
                                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    <SparklesIcon className="w-4 h-4" />
                                    Create campaign
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 flex items-start gap-3 flex-wrap">
                            <div className="shrink-0 text-xs text-gray-500 mt-1">Countries</div>
                            <div className="flex items-center gap-2 flex-1 flex-wrap">
                                {marketItems.length === 0 && (
                                    <span className="text-xs text-gray-400">Use 🌍 to add markets or clusters</span>
                                )}
                                {marketItems.map((c, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-xs">
                                        {c.type === 'single' ? '🌐' : '🗂️'} {c.name}
                                        <button onClick={() => removeItem(i)} className="text-gray-500 hover:text-black">×</button>
                                    </span>
                                ))}
                            </div>
                            {attachments.map((f, i) => (
                                <span key={`att-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-50 border text-[11px]">
                                    📎 {f.name}
                                    <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-black">×</button>
                                </span>
                            ))}
                        </div>

                        {!hasKey && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
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
        return sortableItems;
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
    const allLangOptions = Array.from(new Set(COUNTRIES.flatMap(c => getMarketWithLangs(c as any).browserLangs)));

    const headers = [
        { key: 'channel', label: 'Channel' },
        { key: 'campaignName', label: 'Campaign Name' },
        { key: 'campaignType', label: 'Campaign Type' },
        { key: 'market', label: 'Market' },
        { key: 'browserLangs', label: 'Browser Langs' },
        { key: 'languages', label: 'Ad Langs' },
        { key: 'actions', label: 'Actions' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-800">2. Review and confirm campaign plan</h2>
                 <button onClick={onBack} className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                    <BackIcon />
                    <span>Back to brief</span>
                </button>
            </div>
            <p className="text-gray-600">Here is the high-level campaign structure generated from your brief. Review the campaigns below and click "Generate Details" to proceed.</p>
            <div className={`border border-gray-200 rounded-lg overflow-x-auto overflow-y-visible`}>
                <table className="w-full text-sm text-left text-gray-600 relative">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            {headers.map(h => (
                                <th key={h.key} scope="col" className="px-6 py-3 cursor-pointer" onClick={() => requestSort(h.key as any)}>
                                    {h.label} {getSortIndicator(h.key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedSummaries.map(s => {
                            const isEditing = editingId === s.id;
                            const marketLabelList = (s.market.iso === 'WW' ? s.market.name.split(',').map(n => n.trim()) : [s.market.name]).map(name => `${name} (${COUNTRIES.find(c=>c.name===name)?.iso || s.market.iso})`);
                            return (
                            <>
                            <tr key={s.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 flex items-center space-x-2"><span className="text-gray-500">{channelIcons[s.channel]}</span><span>{s.channel}</span></td>
                                <td className="px-6 py-3 font-medium text-gray-900 whitespace-nowrap">{s.campaignName}</td>
                                <td className="px-6 py-3">{s.campaignType}</td>
                                <td className="px-6 py-3">{s.market.name} ({s.market.iso})</td>
                                <td className="px-6 py-3">{s.market.browserLangs.join(', ')}</td>
                                <td className="px-6 py-3">{s.languages.map(langNameFromCode).join(', ')}</td>
                                <td className="px-6 py-3 text-right"><button onClick={() => setEditingId(s.id)} className="text-xs px-2 py-1 rounded-md border border-gray-200">Edit</button></td>
                            </tr>
                            {isEditing && (
                                <tr className="bg-gray-50 border-b">
                                    <td colSpan={headers.length} className="px-6 py-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Campaign Name</label>
                                                <input value={s.campaignName} onChange={(e)=> onUpdate(s.id, prev => ({...prev, campaignName: e.target.value}))} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1" />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Campaign Type</label>
                                                <select value={s.campaignType} onChange={(e)=> onUpdate(s.id, prev => ({...prev, campaignType: e.target.value}))} className="w-full text-sm border border-gray-200 rounded-md px-2 py-1 bg-white">
                                                    <option value="Brand">Brand</option>
                                                    <option value="PMax">PMax</option>
                                                    <option value="Remarketing">Remarketing</option>
                                                    <option value="Hotel Ads">Hotel Ads</option>
                                                </select>
                                            </div>
                                            <div className="sm:col-span-2">
                                                <MultiSelectDropdown label="Markets" options={countryLabels} selectedOptions={marketLabelList} onToggle={(label) => {
                                                    const currentSet = new Set<string>(marketLabelList);
                                                    if (currentSet.has(label)) currentSet.delete(label); else currentSet.add(label);
                                                    const arr = Array.from(currentSet);
                                                    const isos = arr.map(parseIso).filter(Boolean);
                                                    const names = marketNamesFromLabels(arr);
                                                    const langs = Array.from(new Set(isos.flatMap(iso => getMarketWithLangs({ name: findMarket(iso)?.name || iso, iso } as any).browserLangs)));
                                                    const nextMarket: Market = arr.length > 1 ? { name: names.join(', '), iso: 'WW', browserLangs: langs } : getMarketWithLangs({ name: names[0] || s.market.name, iso: isos[0] || s.market.iso } as any);
                                                    onUpdate(s.id, prev => ({...prev, market: nextMarket }));
                                                }} />
                                            </div>
                                            <div>
                                                <MultiSelectDropdown label="Browser Langs" options={allLangOptions} selectedOptions={s.market.browserLangs} onToggle={(opt) => {
                                                    const set = new Set(s.market.browserLangs);
                                                    set.has(opt) ? set.delete(opt) : set.add(opt);
                                                    onUpdate(s.id, prev => ({...prev, market: { ...prev.market, browserLangs: Array.from(set) }}));
                                                }} />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Ad Language</label>
                                                <select
                                                    value={s.languages[0] ? langNameFromCode(s.languages[0]) : ''}
                                                    onChange={(e) => {
                                                        const selected = e.target.value;
                                                        const code = langCodeFromName(selected);
                                                        onUpdate(s.id, prev => ({ ...prev, languages: selected ? [code] : [] }));
                                                    }}
                                                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-1 bg-white"
                                                >
                                                    <option value="">Select language</option>
                                                    {LANGUAGE_LIST.map(l => (
                                                        <option key={l.code} value={l.name}>{l.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex justify-end gap-2">
                                            <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded-md bg-black text-white">Done</button>
                                            <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded-md bg-gray-100">Cancel</button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
             <button onClick={onConfirm} className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
                <SparklesIcon className="w-5 h-5 mr-2" />
                Generate Details
            </button>
        </div>
    );
};

const DetailsView = ({ campaigns, brief, setCampaigns, onBack }: { campaigns: FullCampaign[], brief: string, setCampaigns: React.Dispatch<React.SetStateAction<FullCampaign[]>>, onBack: () => void }) => {
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
        <div className="space-y-4">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-gray-800">3. Fine-tune your campaigns</h2>
                 <button onClick={onBack} className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                    <BackIcon />
                    <span>Back to summary</span>
                </button>
            </div>
            <p className="text-gray-600">All creative assets have been generated. You can now edit, delete, or generate new assets for each campaign.</p>
            <div className="flex items-start space-x-6">
                <aside className="w-1/4 sticky top-24">
                    <nav className="flex flex-col space-y-1">
                        {campaigns.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCampaignId(c.id)}
                                className={`flex items-center space-x-3 p-3 rounded-lg text-left transition-colors ${selectedCampaignId === c.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
                            >
                                <span className="text-gray-500">{channelIcons[c.channel]}</span>
                                <div className="flex-grow">
                                    <p className="text-sm font-semibold">{c.campaignName}</p>
                                    <p className="text-xs text-gray-500">{c.market.name}</p>
                                </div>
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="w-3/4">
                    {selectedCampaign && (
                        <div key={selectedCampaign.id}>
                            {selectedCampaign.channel === 'Google' && <GoogleCampaignDetails campaign={selectedCampaign} allCampaigns={campaigns} brief={brief} onUpdate={handleUpdate(selectedCampaign.id)} onAdd={handleAdd(selectedCampaign.id)} onDelete={handleDelete(selectedCampaign.id)} onGenerate={handleGenerate(selectedCampaign)} onRewrite={handleRewrite(selectedCampaign)} />}
                            {selectedCampaign.channel === 'Meta' && <MetaCampaignDetails campaign={selectedCampaign} brief={brief} onUpdate={handleUpdate(selectedCampaign.id)} onAdd={handleAdd(selectedCampaign.id)} onDelete={handleDelete(selectedCampaign.id)} onGenerate={handleGenerate(selectedCampaign)} onRewrite={handleRewrite(selectedCampaign)} />}
                            {selectedCampaign.channel === 'TikTok' && <TikTokCampaignDetails campaign={selectedCampaign} brief={brief} onUpdate={handleUpdate(selectedCampaign.id)} onAdd={handleAdd(selectedCampaign.id)} onDelete={handleDelete(selectedCampaign.id)} onGenerate={handleGenerate(selectedCampaign)} onRewrite={handleRewrite(selectedCampaign)} />}
                        </div>
                    )}
                </main>
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

    const handleGenerateSummary = async (prompt: string, channels: Channel[], manualParams?: { primaryMarkets: Market[]; secondaryMarkets: Market[]; campaignTypes: string[]; }) => {
        setIsLoading(true);
        setError(null);
        setBrief(prompt);
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
                return <InputView onGenerate={handleGenerateSummary} />;
            case 'summary':
                return <CampaignSummaryTable summaries={summaries} onSelect={() => {}} onConfirm={handleGenerateDetails} onBack={resetToInput} onUpdate={(id, updater) => setSummaries(prev => prev.map(s => s.id === id ? updater(s) : s))} />;
            case 'details':
                return <DetailsView campaigns={campaigns} setCampaigns={setCampaigns} brief={brief} onBack={backToSummary} />;
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header />
            <main className="max-w-6xl mx-auto p-4 md:p-8">
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
                {renderContent()}
            </main>
        </div>
    );
};

// Channel dropdown component
const ChannelDropdown = ({ selected, onSelect }: { selected: Channel, onSelect: (c: Channel) => void }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    const options: Array<Channel | 'Bing'> = ['Google','Meta','TikTok','Bing'];
    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setOpen(v=>!v)} className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors">
                <img src={channelIconSrc[selected]} className="w-4 h-4" alt={selected} />
                {selected === 'Google' ? 'Adwords' : selected}
                <svg className="w-2 h-2 fill-current" viewBox="0 0 7 5"><path d="M3.5 5L0.468911 0.5L6.53109 0.5L3.5 5Z"/></svg>
            </button>
            {open && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg p-1">
                    {options.map(opt => {
                        const isDisabled = opt !== 'Google';
                        return (
                            <button
                                key={opt}
                                disabled={isDisabled}
                                onClick={() => { if (!isDisabled) { onSelect('Google'); setOpen(false); } }}
                                className={`flex items-center justify-between w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-50 ${opt===selected ? 'bg-blue-50 text-blue-800' : ''} ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <img src={channelIconSrc[opt as string]} className="w-4 h-4" alt={`${opt}`} />
                                    <span>{opt === 'Google' ? 'Adwords' : opt}</span>
                                </span>
                                {isDisabled && <span className="ml-2 text-[10px] text-gray-500 whitespace-nowrap">Coming soon</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    )
}

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
