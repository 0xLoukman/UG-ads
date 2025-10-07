// This is the new GoogleCampaignDetails component based on Figma design
// To use: Copy this content and replace the existing GoogleCampaignDetails in App.tsx

const GoogleCampaignDetailsNew = ({ campaign, allCampaigns, brief, onUpdate, onAdd, onDelete, onGenerate, onRewrite, onPickFromLibrary, onOpenGenerator, onPickBanner }: { campaign: FullCampaign, allCampaigns: FullCampaign[], brief: string, onUpdate: (path: (string | number)[], value: any) => void, onAdd: (path: (string | number)[], value: any) => void, onDelete: (path: (string | number)[]) => void, onGenerate: (assetType: AssetType, existing: string[]) => Promise<string>, onRewrite: (assetType: AssetType, existing: string[], toRewrite: string) => Promise<string>, onPickFromLibrary: (type: 'images'|'logos', max: number, onSelect: (urls: string[]) => void) => void, onOpenGenerator: () => void, onPickBanner: (onSelect: (preset: BannerPreset) => void) => void }) => {
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
            {/* Ad Groups / Asset Groups Section */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">{isPMax ? 'Asset Groups' : 'Ad Groups'}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">These are the campaigns generated</p>
                    </div>
                    <button
                        onClick={isPMax ? () => {} : addAdGroup}
                        disabled={creatingGroup}
                        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 flex items-center gap-2"
                    >
                        {creatingGroup ? <SpinnerIcon className="w-4 h-4 text-white"/> : null}
                        {isPMax ? 'New Asset Group' : 'New Ad Group'}
                    </button>
                </div>

                {/* Asset Groups for PMax */}
                {isPMax && googleAds.assetGroups?.map((ag, agIndex) => (
                    <div key={ag.id} className="border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900">{ag.name}</h4>
                            </div>
                            <button
                                onClick={() => setExpandedAssetGroupId(expandedAssetGroupId === ag.id ? null : ag.id)}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
                            >
                                Edit asset group
                            </button>
                        </div>
                        {expandedAssetGroupId === ag.id && (
                            <div className="px-6 pb-6 bg-gray-50 space-y-3">
                                <EditableField value={ag.finalUrl} onSave={(newValue) => onUpdate(['googleAds', 'assetGroups', agIndex, 'finalUrl'], newValue)} fieldType="url" />

                                <UploadSection label="Images" hint="Add up to 15 images" accept="image/*" max={15} items={ag.images || []} onAddFiles={(files) => { const urls = Array.from(files).slice(0, 15).map(f => URL.createObjectURL(f)); const next = [ ...(ag.images || []), ...urls ].slice(0, 15); onUpdate(['googleAds','assetGroups', agIndex, 'images'], next); }} onRemove={(i) => { const next = (ag.images || []).filter((_,idx)=>idx!==i); onUpdate(['googleAds','assetGroups', agIndex, 'images'], next); }} onChooseFromLibrary={() => onPickFromLibrary('images', 15, (urls) => { const next = [ ...(ag.images || []), ...urls ].slice(0, 15); onUpdate(['googleAds','assetGroups', agIndex, 'images'], next); })} onOpenGenerator={onOpenGenerator} onChooseBanner={() => onPickBanner((preset) => { const urls = (preset.images || []).slice(0, 15); const next = [ ...(ag.images || []), ...urls ].slice(0, 15); onUpdate(['googleAds','assetGroups', agIndex, 'images'], next); if (preset.logo) { const logosNext = [ ...(ag.logos || []), preset.logo ].slice(0, 5); onUpdate(['googleAds','assetGroups', agIndex, 'logos'], logosNext); } })} />

                                <UploadSection label="Logos" hint="Add up to 5 logos" accept="image/*" max={5} items={ag.logos || []} onAddFiles={(files) => { const urls = Array.from(files).slice(0, 5).map(f => URL.createObjectURL(f)); const next = [ ...(ag.logos || []), ...urls ].slice(0, 5); onUpdate(['googleAds','assetGroups', agIndex, 'logos'], next); }} onRemove={(i) => { const next = (ag.logos || []).filter((_,idx)=>idx!==i); onUpdate(['googleAds','assetGroups', agIndex, 'logos'], next); }} onChooseFromLibrary={() => onPickFromLibrary('logos', 5, (urls) => { const next = [ ...(ag.logos || []), ...urls ].slice(0, 5); onUpdate(['googleAds','assetGroups', agIndex, 'logos'], next); })} onOpenGenerator={onOpenGenerator} onChooseBanner={() => onPickBanner((preset) => { if (preset.logo) { const logosNext = [ ...(ag.logos || []), preset.logo ].slice(0, 5); onUpdate(['googleAds','assetGroups', agIndex, 'logos'], logosNext); } const urls = (preset.images || []).slice(0, 15); if (urls.length) { const next = [ ...(ag.images || []), ...urls ].slice(0, 15); onUpdate(['googleAds','assetGroups', agIndex, 'images'], next); } })} />

                                <UploadSection label="Videos" hint="Add up to 5 videos" accept="video/*" max={5} items={ag.videos || []} onAddFiles={(files) => { const urls = Array.from(files).slice(0, 5).map(f => URL.createObjectURL(f)); const next = [ ...(ag.videos || []), ...urls ].slice(0, 5); onUpdate(['googleAds','assetGroups', agIndex, 'videos'], next); }} onRemove={(i) => { const next = (ag.videos || []).filter((_,idx)=>idx!==i); onUpdate(['googleAds','assetGroups', agIndex, 'videos'], next); }} />

                                <EditableList title="Headlines" items={ag.headlines} assetType="headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'headlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'headlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'headlines', i])} onGenerate={(e) => onGenerate('headline', e)} onRewrite={(e, r) => onRewrite('headline', e, r)} />
                                <EditableList title="Long Headlines" items={ag.longHeadlines} assetType="long headline" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'longHeadlines'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'longHeadlines', i])} onGenerate={(e) => onGenerate('long headline', e)} onRewrite={(e, r) => onRewrite('long headline', e, r)} />
                                <EditableList title="Descriptions" items={ag.descriptions} assetType="description" onUpdate={(i, v) => onUpdate(['googleAds', 'assetGroups', agIndex, 'descriptions', i], v)} onAdd={(v) => onAdd(['googleAds', 'assetGroups', agIndex, 'descriptions'], v)} onDelete={(i) => onDelete(['googleAds', 'assetGroups', agIndex, 'descriptions', i])} onGenerate={(e) => onGenerate('description', e)} onRewrite={(e, r) => onRewrite('description', e, r)} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Ad Groups for Brand/Search */}
                {!isPMax && googleAds.adGroups?.map((adg, adgIndex) => (
                    <div key={adg.id} className="border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900">{adg.name}</h4>
                            </div>
                            <button
                                onClick={() => setExpandedAdId(expandedAdId === adg.id ? null : adg.id)}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
                            >
                                Edit ad group
                            </button>
                        </div>
                        {expandedAdId === adg.id && (
                            <div className="px-6 pb-6 bg-gray-50">
                                <FieldSection title="Assign to campaign" hint="Select the campaign this ad group belongs to">
                                    <div className="flex items-center gap-2">
                                        <select value={(adg as any).assignedCampaignName || campaign.campaignName} onChange={(e) => onUpdate(['googleAds','adGroups', adgIndex, 'assignedCampaignName'], e.target.value)} className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white">
                                            <option value="">Unassigned</option>
                                            <option value={campaign.campaignName}>{campaign.campaignName}</option>
                                        </select>
                                        <div className="ml-auto text-xs text-gray-500">Assigned Ads: {(googleAds as any).ads ? ((googleAds as any).ads as any[]).filter(a => (a.assignedTargets || []).some((t:any)=> t.source==='plan' && t.adGroupId===adg.id) || a.assignedAdGroupId === adg.id).length : 0}</div>
                                    </div>
                                </FieldSection>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Ads Section for Brand/Search */}
            {!isPMax && (
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Ads</h3>
                        <p className="text-sm text-gray-500 mt-0.5">These are the campaigns generated</p>
                    </div>
                    <button onClick={async () => { try { setCreatingAd(true); const ad = await generateGoogleSearchAd(brief, campaign); const firstGroupId = googleAds.adGroups?.[0]?.id || null; (ad as any).assignedTargets = firstGroupId ? [{ source: 'plan', adGroupId: firstGroupId }] : []; const existing: any[] = (googleAds as any).ads || []; onUpdate(['googleAds', 'ads'], [ad, ...existing]); setExpandedAdId(ad.id); } finally { setCreatingAd(false); } }} disabled={creatingAd} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 flex items-center gap-2">
                        {creatingAd ? <SpinnerIcon className="w-4 h-4 text-white"/> : null}
                        Create Ad
                    </button>
                </div>

                {((googleAds as any).ads || []).map((ad: any, adIndex: number) => (
                    <CollapsibleCard key={ad.id} title={ad.headlines?.[0] || ad.finalUrl || `Ad ${adIndex + 1}`} onUpdateTitle={(newTitle) => onUpdate(['googleAds','ads', adIndex, 'headlines', 0], newTitle)} onDelete={() => onDelete(['googleAds','ads', adIndex])}>
                        <FieldSection title="Assign" hint="Select campaigns and ad groups">
                            <AssignPillsPicker value={ad.assignedTargets || []} onChange={(next) => onUpdate(['googleAds','ads', adIndex, 'assignedTargets'], next)} planCombos={currentPlanCombos} />
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
            </div>
            )}

            {/* Geographic Targeting Section */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900">Geographic Targeting</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Select countries to target</p>
                </div>
                <div className="px-6 py-4">
                    <label className="block text-sm text-gray-700 font-medium mb-2">Markets</label>
                    <div className="flex items-center gap-2 flex-wrap p-3 border border-gray-200 rounded-lg bg-white min-h-[48px]">
                        {selectedMarkets.map((market, idx) => (
                            <span key={idx} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm">
                                <span className="text-base">{getCountryFlag(market.iso)}</span>
                                {market.name}
                                <button onClick={() => setSelectedMarkets(prev => prev.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-gray-600">×</button>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Budget Section */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900">Budget</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Define your campaign budget</p>
                </div>
                <div className="px-6 py-4 flex items-end gap-6">
                    <div className="flex-1">
                        <label className="block text-sm text-gray-700 font-medium mb-2">Budget</label>
                        <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
                            <span className="text-sm text-gray-900">$</span>
                            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="flex-1 text-sm border-none focus:outline-none focus:ring-0 p-0" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-gray-700">Suggested budget: $500/day based on your account settings and active campaigns</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
