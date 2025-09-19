import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { FullCampaign, CampaignSummary, AssetGroup, AdGroup, Ad, Channel, MetaAdSet, TikTokAdGroup, MetaAd, TikTokAd, Market } from "./types";
import { generateCampaignSummary, generateCampaignDetails, generateCreativeAsset, AssetType } from "./services/geminiService";

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
const ChevronDownIcon = ({className="w-4 h-4"}) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;

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


const channelIcons: Record<Channel, React.ReactNode> = {
    Google: <GoogleIcon />,
    Meta: <MetaIcon />,
    TikTok: <TiktokIcon />,
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

const GoogleCampaignDetails = ({ campaign, brief, onUpdate, onAdd, onDelete, onGenerate, onRewrite }: { campaign: FullCampaign, brief: string, onUpdate: (path: (string | number)[], value: any) => void, onAdd: (path: (string | number)[], value: any) => void, onDelete: (path: (string | number)[]) => void, onGenerate: (assetType: AssetType, existing: string[]) => Promise<string>, onRewrite: (assetType: AssetType, existing: string[], toRewrite: string) => Promise<string> }) => {
    const { googleAds } = campaign;
    if (!googleAds) return null;

    return (
        <>
            {googleAds.assetGroups?.map((ag, agIndex) => (
                <CollapsibleCard
                    key={ag.id}
                    title={ag.name}
                    onUpdateTitle={(newTitle) => onUpdate(['googleAds', 'assetGroups', agIndex, 'name'], newTitle)}
                    onDelete={() => onDelete(['googleAds', 'assetGroups', agIndex])}
                >
                    <EditableField value={ag.finalUrl} onSave={(newValue) => onUpdate(['googleAds', 'assetGroups', agIndex, 'finalUrl'], newValue)} />
                    <EditableList title="Headlines" items={ag.headlines} assetType="headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'headlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'headlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'headlines', i])} onGenerate={(e) => onGenerate('headline', e)} onRewrite={(e, r) => onRewrite('headline', e, r)} />
                    <EditableList title="Long Headlines" items={ag.longHeadlines} assetType="long headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'longHeadlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i])} onGenerate={(e) => onGenerate('long headline', e)} onRewrite={(e, r) => onRewrite('long headline', e, r)} />
                    <EditableList title="Descriptions" items={ag.descriptions} assetType="description" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'descriptions', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'descriptions'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'descriptions', i])} onGenerate={(e) => onGenerate('description', e)} onRewrite={(e, r) => onRewrite('description', e, r)} />
                </CollapsibleCard>
            ))}
            {googleAds.adGroups?.map((adg, adgIndex) => (
                <CollapsibleCard
                    key={adg.id}
                    title={adg.name}
                    onUpdateTitle={(newTitle) => onUpdate(['googleAds', 'adGroups', adgIndex, 'name'], newTitle)}
                    onDelete={() => onDelete(['googleAds', 'adGroups', adgIndex])}
                >
                    {adg.ads.map((ad, adIndex) => (
                        <div key={ad.id} className="border-t border-gray-200 mt-4 pt-4 first:mt-0 first:pt-0 first:border-0">
                            <EditableField value={ad.finalUrl} onSave={(newValue) => onUpdate(['googleAds', 'adGroups', adgIndex, 'ads', adIndex, 'finalUrl'], newValue)} />
                            <EditableList title="Headlines" items={ad.headlines} assetType="headline" onUpdate={(i, v) => onUpdate(['googleAds', 'adGroups', adgIndex, 'ads', adIndex, 'headlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'adGroups', adgIndex, 'ads', adIndex, 'headlines'], v)} onDelete={(i) => onDelete(['googleAds', 'adGroups', adgIndex, 'ads', adIndex, 'headlines', i])} onGenerate={(e) => onGenerate('headline', e)} onRewrite={(e, r) => onRewrite('headline', e, r)} />
                            <EditableList title="Descriptions" items={ad.descriptions} assetType="description" onUpdate={(i, v) => onUpdate(['googleAds', 'adGroups', adgIndex, 'ads', adIndex, 'descriptions', i], v)} onAdd={(v) => onAdd(['googleAds', 'adGroups', adgIndex, 'ads', adIndex, 'descriptions'], v)} onDelete={(i) => onDelete(['googleAds', 'adGroups', adgIndex, 'ads', adIndex, 'descriptions', i])} onGenerate={(e) => onGenerate('description', e)} onRewrite={(e, r) => onRewrite('description', e, r)} />
                        </div>
                    ))}
                </CollapsibleCard>
            ))}
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

const MarketSelector = ({ label, selectedMarkets, onAdd, onRemove, allSelectedMarkets }: { label: string, selectedMarkets: Market[], onAdd: (market: Market) => void, onRemove: (market: Market) => void, allSelectedMarkets: Market[] }) => {
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
            <label className="text-sm font-medium text-gray-700">{label}</label>
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
                        placeholder="Search for a country..."
                        className="flex-grow p-0 border-none focus:ring-0"
                    />
                </div>
                {isOpen && filteredCountries.length > 0 && (
                    <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {filteredCountries.map(c => (
                            <li key={c.iso} onClick={() => handleSelect(c)} className="px-4 py-2 cursor-pointer hover:bg-gray-100">
                                {c.name}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const MultiSelectDropdown = ({ label, options, selectedOptions, onToggle }: { label: string, options: string[], selectedOptions: string[], onToggle: (option: string) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
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

    return (
        <div ref={containerRef}>
             <label className="text-sm font-medium text-gray-700">{label}</label>
             <div className="relative mt-1">
                <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2 border border-gray-200 rounded-lg flex justify-between items-center text-left min-h-[42px]">
                    <div className="flex flex-wrap gap-1.5">
                        {selectedOptions.length > 0 
                            ? selectedOptions.map(option => (
                                <span key={option} className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                                    {option}
                                </span>
                            ))
                            : <span className="text-gray-500">Select campaign types...</span>}
                    </div>
                    <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                     <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {options.map(option => (
                            <li key={option} onClick={() => onToggle(option)} className="px-4 py-2 cursor-pointer hover:bg-gray-100 flex items-center justify-between">
                               <span>{option}</span>
                               {selectedOptions.includes(option) && (
                                   <svg className="w-5 h-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                   </svg>
                               )}
                            </li>
                        ))}
                    </ul>
                )}
             </div>
        </div>
    )
}

const InputView = ({ onGenerate }: { onGenerate: (prompt: string, channels: Channel[], manualParams?: { primaryMarkets: Market[]; secondaryMarkets: Market[]; campaignTypes: string[]; }) => void }) => {
    const [inputMode, setInputMode] = useState<InputMode>('prompt');
    const [brief, setBrief] = useState("");
    const [selectedChannels, setSelectedChannels] = useState<Channel[]>(['Meta']);

    // State for Manual Mode
    const [manualPrimaryMarkets, setManualPrimaryMarkets] = useState<Market[]>([]);
    const [manualSecondaryMarkets, setManualSecondaryMarkets] = useState<Market[]>([]);
    const [manualCampaignTypes, setManualCampaignTypes] = useState<string[]>([]);
    
    const allSelectedMarkets = useMemo(() => [...manualPrimaryMarkets, ...manualSecondaryMarkets], [manualPrimaryMarkets, manualSecondaryMarkets]);

    const handleToggleChannel = (channel: Channel) => {
        setSelectedChannels(prev =>
            prev.includes(channel)
                ? prev.filter(c => c !== channel)
                : [...prev, channel]
        );
    };

    const handleGenerate = () => {
        if (!brief.trim()) return;
        
        if (inputMode === 'manual') {
            onGenerate(brief, selectedChannels, { 
                primaryMarkets: manualPrimaryMarkets, 
                secondaryMarkets: manualSecondaryMarkets, 
                campaignTypes: manualCampaignTypes 
            });
        } else {
            onGenerate(brief, selectedChannels);
        }
    };
    
    const isGenerateDisabled = !brief.trim() || selectedChannels.length === 0 || (inputMode === 'manual' && (allSelectedMarkets.length === 0 || manualCampaignTypes.length === 0));

    return (
        <div className="flex justify-center items-start pt-8 sm:pt-16">
            <div className="w-full max-w-3xl space-y-6">
                <h2 className="text-3xl font-bold text-gray-800 text-center tracking-tight">What campaign you would like to launch</h2>
                <div className="bg-white border border-gray-200 rounded-2xl p-2 shadow-sm">
                    {/* Mode Toggle */}
                    <div className="flex justify-center p-2">
                        <div className="bg-gray-100 p-1 rounded-full flex space-x-1">
                            <button onClick={() => setInputMode('prompt')} className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${inputMode === 'prompt' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                AI Prompt
                            </button>
                            <button onClick={() => setInputMode('manual')} className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${inputMode === 'manual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                Manual Setup
                            </button>
                        </div>
                    </div>
                    
                    {inputMode === 'prompt' ? (
                        <textarea
                            value={brief}
                            onChange={(e) => setBrief(e.target.value)}
                            className="w-full h-32 p-3 border-0 rounded-lg focus:ring-0 resize-none text-gray-700 placeholder-gray-400"
                            placeholder="Enter all the details about the campaign you would like to create, including markets, campaign types, and creative direction..."
                        />
                    ) : (
                         <div className="p-3 space-y-4">
                            <div>
                                 <label className="text-sm font-medium text-gray-700">Creative Brief</label>
                                 <textarea
                                    value={brief}
                                    onChange={(e) => setBrief(e.target.value)}
                                    className="w-full h-24 mt-1 p-3 border border-gray-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-700 placeholder-gray-400"
                                    placeholder="Describe your product, target audience, and key messaging..."
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <MarketSelector 
                                    label="Primary Markets (separate campaigns)"
                                    selectedMarkets={manualPrimaryMarkets}
                                    onAdd={(market) => setManualPrimaryMarkets(prev => [...prev, market])}
                                    onRemove={(market) => setManualPrimaryMarkets(prev => prev.filter(m => m.iso !== market.iso))}
                                    allSelectedMarkets={allSelectedMarkets}
                                />
                                <MarketSelector 
                                    label="Secondary Markets (clustered campaign)"
                                    selectedMarkets={manualSecondaryMarkets}
                                    onAdd={(market) => setManualSecondaryMarkets(prev => [...prev, market])}
                                    onRemove={(market) => setManualSecondaryMarkets(prev => prev.filter(m => m.iso !== market.iso))}
                                    allSelectedMarkets={allSelectedMarkets}
                                />
                            </div>
                             <MultiSelectDropdown
                                label="Campaign Types"
                                options={ALL_CAMPAIGN_TYPES}
                                selectedOptions={manualCampaignTypes}
                                onToggle={(option) => {
                                    setManualCampaignTypes(prev => 
                                        prev.includes(option) 
                                            ? prev.filter(t => t !== option)
                                            : [...prev, option]
                                    )
                                }}
                            />
                         </div>
                    )}

                    <div className="flex justify-between items-center mt-2 p-2">
                        <div className="flex items-center space-x-2">
                            <ChannelButton channel="TikTok" icon={<TiktokIcon />} selected={selectedChannels.includes('TikTok')} onClick={handleToggleChannel} />
                            <ChannelButton channel="Google" icon={<GoogleIcon />} selected={selectedChannels.includes('Google')} onClick={handleToggleChannel} />
                            <ChannelButton channel="Meta" icon={<MetaIcon />} selected={selectedChannels.includes('Meta')} onClick={handleToggleChannel} />
                        </div>
                        <button 
                            onClick={handleGenerate} 
                            disabled={isGenerateDisabled}
                            className="flex items-center justify-center space-x-2 bg-black text-white font-semibold py-2 px-5 rounded-full hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            <span>Create campaign</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const CampaignSummaryTable = ({ summaries, onSelect, onConfirm, onBack }: { summaries: CampaignSummary[], onSelect: (id: string) => void, onConfirm: () => void, onBack: () => void }) => {
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

    const headers = [
        { key: 'channel', label: 'Channel' },
        { key: 'campaignName', label: 'Campaign Name' },
        { key: 'campaignType', label: 'Campaign Type' },
        { key: 'market', label: 'Market' },
        { key: 'browserLangs', label: 'Browser Langs' },
        { key: 'languages', label: 'Ad Langs' },
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
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm text-left text-gray-600">
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
                        {sortedSummaries.map(s => (
                            <tr key={s.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 flex items-center space-x-2"><span className="text-gray-500">{channelIcons[s.channel]}</span><span>{s.channel}</span></td>
                                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{s.campaignName}</td>
                                <td className="px-6 py-4">{s.campaignType}</td>
                                <td className="px-6 py-4">{s.market.name} ({s.market.iso})</td>
                                <td className="px-6 py-4">{s.market.browserLangs.join(', ')}</td>
                                <td className="px-6 py-4">{s.languages.join(', ')}</td>
                            </tr>
                        ))}
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
                            {selectedCampaign.channel === 'Google' && <GoogleCampaignDetails campaign={selectedCampaign} brief={brief} onUpdate={handleUpdate(selectedCampaign.id)} onAdd={handleAdd(selectedCampaign.id)} onDelete={handleDelete(selectedCampaign.id)} onGenerate={handleGenerate(selectedCampaign)} onRewrite={handleRewrite(selectedCampaign)} />}
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
                return <CampaignSummaryTable summaries={summaries} onSelect={() => {}} onConfirm={handleGenerateDetails} onBack={resetToInput} />;
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

export default App;