"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("./App.css");
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
async function apiFetch(path, apiKey, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
            ...(options.headers ?? {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    return (await res.json());
}
function App() {
    const [apiKeyInput, setApiKeyInput] = (0, react_1.useState)('');
    const [apiKey, setApiKey] = (0, react_1.useState)(() => {
        return localStorage.getItem('admin_api_key');
    });
    const [activeTab, setActiveTab] = (0, react_1.useState)('institutions');
    const [institutions, setInstitutions] = (0, react_1.useState)([]);
    const [institutionsError, setInstitutionsError] = (0, react_1.useState)(null);
    const [institutionsLoading, setInstitutionsLoading] = (0, react_1.useState)(false);
    const [selectedInstitutionId, setSelectedInstitutionId] = (0, react_1.useState)(null);
    const [apiKeys, setApiKeys] = (0, react_1.useState)([]);
    const [apiKeysLoading, setApiKeysLoading] = (0, react_1.useState)(false);
    const [templates, setTemplates] = (0, react_1.useState)([]);
    const [assets, setAssets] = (0, react_1.useState)([]);
    const [positions, setPositions] = (0, react_1.useState)([]);
    const [policies, setPolicies] = (0, react_1.useState)([]);
    const [createInstitutionName, setCreateInstitutionName] = (0, react_1.useState)('');
    const [createInstitutionRegions, setCreateInstitutionRegions] = (0, react_1.useState)('EU_UK');
    const [newApiKeyLabel, setNewApiKeyLabel] = (0, react_1.useState)('admin-key');
    const [newApiKeyRole, setNewApiKeyRole] = (0, react_1.useState)('admin');
    const [createdApiKeyToken, setCreatedApiKeyToken] = (0, react_1.useState)(null);
    const [newTemplateCode, setNewTemplateCode] = (0, react_1.useState)('CONSTR_ESCROW');
    const [newTemplateName, setNewTemplateName] = (0, react_1.useState)('Construction Escrow');
    const [newTemplateRegion, setNewTemplateRegion] = (0, react_1.useState)('EU_UK');
    const [newTemplateVertical, setNewTemplateVertical] = (0, react_1.useState)('CONSTRUCTION');
    const [newAssetLabel, setNewAssetLabel] = (0, react_1.useState)('New Asset');
    const [newAssetTemplateId, setNewAssetTemplateId] = (0, react_1.useState)(null);
    const [newPositionAssetId, setNewPositionAssetId] = (0, react_1.useState)(null);
    const [newPositionHolder, setNewPositionHolder] = (0, react_1.useState)('HOLDER_1');
    const [newPositionCurrency, setNewPositionCurrency] = (0, react_1.useState)('USD');
    const [newPositionAmount, setNewPositionAmount] = (0, react_1.useState)(1000);
    const [selectedPositionId, setSelectedPositionId] = (0, react_1.useState)(null);
    const [ledgerEvents, setLedgerEvents] = (0, react_1.useState)([]);
    const selectedInstitution = (0, react_1.useMemo)(() => institutions.find((i) => i.id === selectedInstitutionId) ?? null, [institutions, selectedInstitutionId]);
    (0, react_1.useEffect)(() => {
        if (!apiKey)
            return;
        setInstitutionsLoading(true);
        setInstitutionsError(null);
        apiFetch('/institutions', apiKey)
            .then((data) => {
            setInstitutions(data);
            if (data.length > 0 && !selectedInstitutionId) {
                setSelectedInstitutionId(data[0].id);
            }
        })
            .catch((err) => {
            setInstitutionsError(err.message);
        })
            .finally(() => {
            setInstitutionsLoading(false);
        });
    }, [apiKey, selectedInstitutionId]);
    (0, react_1.useEffect)(() => {
        if (!apiKey || !selectedInstitutionId)
            return;
        setApiKeysLoading(true);
        apiFetch(`/institutions/${selectedInstitutionId}/api-keys`, apiKey)
            .then(setApiKeys)
            .catch(() => {
            setApiKeys([]);
        })
            .finally(() => setApiKeysLoading(false));
        apiFetch(`/asset-templates?institutionId=${selectedInstitutionId}`, apiKey)
            .then((data) => {
            setTemplates(data);
            if (data.length > 0 && !newAssetTemplateId) {
                setNewAssetTemplateId(data[0].id);
            }
        })
            .catch(() => setTemplates([]));
        apiFetch(`/assets?institutionId=${selectedInstitutionId}`, apiKey)
            .then(setAssets)
            .catch(() => setAssets([]));
        apiFetch(`/positions?institutionId=${selectedInstitutionId}`, apiKey)
            .then(setPositions)
            .catch(() => setPositions([]));
        apiFetch(`/institutions/${selectedInstitutionId}/policies`, apiKey)
            .then(setPolicies)
            .catch(() => setPolicies([]));
    }, [apiKey, selectedInstitutionId, newAssetTemplateId]);
    (0, react_1.useEffect)(() => {
        if (!apiKey || !selectedPositionId) {
            setLedgerEvents([]);
            return;
        }
        apiFetch(`/ledger-events?positionId=${selectedPositionId}`, apiKey)
            .then(setLedgerEvents)
            .catch(() => setLedgerEvents([]));
    }, [apiKey, selectedPositionId]);
    const handleSaveApiKeyLocally = () => {
        if (!apiKeyInput.trim())
            return;
        localStorage.setItem('admin_api_key', apiKeyInput.trim());
        setApiKey(apiKeyInput.trim());
    };
    const handleCreateInstitution = async () => {
        if (!apiKey)
            return;
        if (!createInstitutionName.trim())
            return;
        const regions = createInstitutionRegions.split(',').map((r) => r.trim()).filter(Boolean);
        const payload = {
            name: createInstitutionName.trim(),
            regions: regions.length > 0 ? regions : ['EU_UK'],
            verticals: ['CONSTRUCTION', 'TRADE_FINANCE'],
        };
        const created = await apiFetch('/institutions', apiKey, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        setInstitutions((prev) => [...prev, created]);
        setCreateInstitutionName('');
    };
    const handleCreateApiKey = async () => {
        if (!apiKey || !selectedInstitutionId)
            return;
        const created = await apiFetch(`/institutions/${selectedInstitutionId}/api-keys`, apiKey, {
            method: 'POST',
            body: JSON.stringify({ label: newApiKeyLabel, role: newApiKeyRole }),
        });
        setCreatedApiKeyToken(created.apiKey);
        setApiKeys((prev) => [
            ...prev,
            {
                id: created.id,
                institutionId: created.institutionId,
                label: created.label,
                role: created.role,
                createdAt: created.createdAt,
            },
        ]);
    };
    const handleCreateTemplate = async () => {
        if (!apiKey || !selectedInstitutionId)
            return;
        const payload = {
            code: newTemplateCode,
            name: newTemplateName,
            vertical: newTemplateVertical,
            region: newTemplateRegion,
            config: { currency: 'USD' },
        };
        const created = await apiFetch('/asset-templates', apiKey, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        setTemplates((prev) => [...prev, created]);
    };
    const handleCreateAsset = async () => {
        if (!apiKey || !newAssetTemplateId)
            return;
        const payload = {
            templateId: newAssetTemplateId,
            label: newAssetLabel,
            metadata: {},
        };
        const created = await apiFetch('/assets', apiKey, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        setAssets((prev) => [...prev, created]);
    };
    const handleCreatePosition = async () => {
        if (!apiKey || !newPositionAssetId)
            return;
        const payload = {
            assetId: newPositionAssetId,
            holderReference: newPositionHolder,
            currency: newPositionCurrency,
            amount: newPositionAmount,
        };
        const created = await apiFetch('/positions', apiKey, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        setPositions((prev) => [...prev, created]);
    };
    const handleTransitionPosition = async (positionId, toState) => {
        if (!apiKey)
            return;
        const updated = await apiFetch(`/positions/${positionId}/transition`, apiKey, {
            method: 'POST',
            body: JSON.stringify({ toState }),
        });
        setPositions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setSelectedPositionId(updated.id);
    };
    const handleSavePolicy = async (institutionId, region, positionConfig) => {
        if (!apiKey)
            return;
        const payload = { position: positionConfig };
        const saved = await apiFetch(`/institutions/${institutionId}/policies/${region}`, apiKey, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        setPolicies((prev) => {
            const others = prev.filter((p) => !(p.institutionId === institutionId && p.region === region));
            return [...others, saved];
        });
    };
    const renderInstitutionsTab = () => ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { children: "Institutions" }), !apiKey && (0, jsx_runtime_1.jsx)("p", { children: "Enter an API key above to load institutions." }), institutionsLoading && (0, jsx_runtime_1.jsx)("p", { children: "Loading institutions..." }), institutionsError && (0, jsx_runtime_1.jsx)("p", { style: { color: 'red' }, children: institutionsError }), institutions.length > 0 && ((0, jsx_runtime_1.jsx)("ul", { children: institutions.map((inst) => ((0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setSelectedInstitutionId(inst.id), style: {
                                fontWeight: inst.id === selectedInstitutionId ? 'bold' : 'normal',
                                marginRight: 8,
                            }, children: inst.name }), (0, jsx_runtime_1.jsxs)("span", { children: ["(", inst.id.slice(0, 6), "..., regions: ", inst.regions.join(', '), ")"] })] }, inst.id))) })), (0, jsx_runtime_1.jsx)("h3", { children: "Create institution (root key required)" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("input", { placeholder: "Name", value: createInstitutionName, onChange: (e) => setCreateInstitutionName(e.target.value) }), (0, jsx_runtime_1.jsx)("input", { placeholder: "Regions (comma separated, e.g. EU_UK,US)", value: createInstitutionRegions, onChange: (e) => setCreateInstitutionRegions(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { onClick: handleCreateInstitution, children: "Create" })] }), selectedInstitution && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("h3", { children: ["API keys for ", selectedInstitution.name] }), apiKeysLoading && (0, jsx_runtime_1.jsx)("p", { children: "Loading API keys..." }), apiKeys.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { children: apiKeys.map((k) => ((0, jsx_runtime_1.jsxs)("li", { children: [k.label, " (", k.role, ") \u2013 created ", new Date(k.createdAt).toLocaleString()] }, k.id))) })) : ((0, jsx_runtime_1.jsx)("p", { children: "No API keys yet." })), (0, jsx_runtime_1.jsx)("h4", { children: "Create new API key" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("input", { placeholder: "Label", value: newApiKeyLabel, onChange: (e) => setNewApiKeyLabel(e.target.value) }), (0, jsx_runtime_1.jsxs)("select", { value: newApiKeyRole, onChange: (e) => setNewApiKeyRole(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "admin", children: "admin" }), (0, jsx_runtime_1.jsx)("option", { value: "read_only", children: "read_only" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: handleCreateApiKey, children: "Create API key" })] }), createdApiKeyToken && ((0, jsx_runtime_1.jsxs)("p", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "New API key (copy now, will not be shown again):" }), ' ', (0, jsx_runtime_1.jsx)("code", { children: createdApiKeyToken })] })), (0, jsx_runtime_1.jsx)("h3", { children: "Policies" }), (0, jsx_runtime_1.jsx)("p", { children: "Configure per-region min/max amounts and allowed currencies for positions." }), (0, jsx_runtime_1.jsxs)("table", { children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "Region" }), (0, jsx_runtime_1.jsx)("th", { children: "Min amount" }), (0, jsx_runtime_1.jsx)("th", { children: "Max amount" }), (0, jsx_runtime_1.jsx)("th", { children: "Allowed currencies (comma-separated)" }), (0, jsx_runtime_1.jsx)("th", { children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: ['US', 'EU_UK', 'SG', 'UAE'].map((region) => {
                                    const existing = policies.find((p) => p.institutionId === selectedInstitution.id && p.region === region);
                                    const positionConfig = existing?.config.position ?? {};
                                    const [minAmountStr, maxAmountStr, allowedCurrenciesStr] = [
                                        positionConfig.minAmount?.toString() ?? '',
                                        positionConfig.maxAmount?.toString() ?? '',
                                        (positionConfig.allowedCurrencies ?? []).join(','),
                                    ];
                                    return ((0, jsx_runtime_1.jsx)(PolicyRow, { institutionId: selectedInstitution.id, region: region, initialMinAmount: minAmountStr, initialMaxAmount: maxAmountStr, initialAllowedCurrencies: allowedCurrenciesStr, onSave: handleSavePolicy }, region));
                                }) })] })] }))] }));
    const renderAssetsTab = () => ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { children: "Asset templates" }), templates.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { children: templates.map((t) => ((0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: t.name }), " (", t.code, ") \u2013 ", t.vertical, " / ", t.region, " \u2013 id:", ' ', t.id.slice(0, 8), "..."] }, t.id))) })) : ((0, jsx_runtime_1.jsx)("p", { children: "No templates yet." })), (0, jsx_runtime_1.jsx)("h3", { children: "Create template" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("select", { value: newTemplateCode, onChange: (e) => setNewTemplateCode(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "CONSTR_ESCROW", children: "CONSTR_ESCROW" }), (0, jsx_runtime_1.jsx)("option", { value: "CONSTR_RETAINAGE", children: "CONSTR_RETAINAGE" }), (0, jsx_runtime_1.jsx)("option", { value: "TF_INVOICE", children: "TF_INVOICE" }), (0, jsx_runtime_1.jsx)("option", { value: "TF_LC", children: "TF_LC" })] }), (0, jsx_runtime_1.jsx)("input", { placeholder: "Name", value: newTemplateName, onChange: (e) => setNewTemplateName(e.target.value) }), (0, jsx_runtime_1.jsxs)("select", { value: newTemplateVertical, onChange: (e) => setNewTemplateVertical(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "CONSTRUCTION", children: "CONSTRUCTION" }), (0, jsx_runtime_1.jsx)("option", { value: "TRADE_FINANCE", children: "TRADE_FINANCE" })] }), (0, jsx_runtime_1.jsxs)("select", { value: newTemplateRegion, onChange: (e) => setNewTemplateRegion(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "US", children: "US" }), (0, jsx_runtime_1.jsx)("option", { value: "EU_UK", children: "EU_UK" }), (0, jsx_runtime_1.jsx)("option", { value: "SG", children: "SG" }), (0, jsx_runtime_1.jsx)("option", { value: "UAE", children: "UAE" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: handleCreateTemplate, children: "Create template" })] }), (0, jsx_runtime_1.jsx)("h2", { children: "Assets" }), assets.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { children: assets.map((a) => {
                    const tpl = templates.find((t) => t.id === a.templateId);
                    return ((0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: a.label }), " \u2013 template: ", tpl ? tpl.name : a.templateId, " \u2013 id:", ' ', a.id.slice(0, 8), "..."] }, a.id));
                }) })) : ((0, jsx_runtime_1.jsx)("p", { children: "No assets yet." })), (0, jsx_runtime_1.jsx)("h3", { children: "Create asset" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("select", { value: newAssetTemplateId ?? '', onChange: (e) => setNewAssetTemplateId(e.target.value || null), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select template" }), templates.map((t) => ((0, jsx_runtime_1.jsxs)("option", { value: t.id, children: [t.name, " (", t.code, ")"] }, t.id)))] }), (0, jsx_runtime_1.jsx)("input", { placeholder: "Label", value: newAssetLabel, onChange: (e) => setNewAssetLabel(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { onClick: handleCreateAsset, children: "Create asset" })] })] }));
    const renderPositionsTab = () => ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { children: "Positions" }), positions.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { children: positions.map((p) => ((0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsxs)("button", { onClick: () => setSelectedPositionId(p.id), style: {
                                fontWeight: p.id === selectedPositionId ? 'bold' : 'normal',
                                marginRight: 8,
                            }, children: [p.id.slice(0, 8), "..."] }), (0, jsx_runtime_1.jsxs)("span", { children: [p.state, " \u2013 ", p.amount, " ", p.currency, " \u2013 asset ", p.assetId.slice(0, 8), "... \u2013 holder", ' ', p.holderReference] }), p.state !== 'RELEASED' && p.state !== 'CANCELLED' && p.state !== 'EXPIRED' && ((0, jsx_runtime_1.jsx)("button", { style: { marginLeft: 8 }, onClick: () => handleTransitionPosition(p.id, 'FUNDED'), children: "Mark FUNDED" }))] }, p.id))) })) : ((0, jsx_runtime_1.jsx)("p", { children: "No positions yet." })), (0, jsx_runtime_1.jsx)("h3", { children: "Create position" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("select", { value: newPositionAssetId ?? '', onChange: (e) => setNewPositionAssetId(e.target.value || null), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select asset" }), assets.map((a) => ((0, jsx_runtime_1.jsxs)("option", { value: a.id, children: [a.label, " (", a.id.slice(0, 8), "...)"] }, a.id)))] }), (0, jsx_runtime_1.jsx)("input", { placeholder: "Holder reference", value: newPositionHolder, onChange: (e) => setNewPositionHolder(e.target.value) }), (0, jsx_runtime_1.jsx)("input", { placeholder: "Currency", value: newPositionCurrency, onChange: (e) => setNewPositionCurrency(e.target.value) }), (0, jsx_runtime_1.jsx)("input", { type: "number", placeholder: "Amount", value: newPositionAmount, onChange: (e) => setNewPositionAmount(Number(e.target.value)) }), (0, jsx_runtime_1.jsx)("button", { onClick: handleCreatePosition, children: "Create position" })] }), selectedPositionId && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("h3", { children: ["Ledger events for position ", selectedPositionId.slice(0, 8), "..."] }), ledgerEvents.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { children: ledgerEvents.map((e) => ((0, jsx_runtime_1.jsxs)("li", { children: ["[", new Date(e.at).toLocaleString(), "] ", e.kind, " ", e.previousState, " \u2192 ", e.newState] }, e.id))) })) : ((0, jsx_runtime_1.jsx)("p", { children: "No ledger events yet." }))] }))] }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "App", children: [(0, jsx_runtime_1.jsxs)("header", { children: [(0, jsx_runtime_1.jsx)("h1", { children: "TAAS Admin Console" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("input", { placeholder: "Enter API key", value: apiKeyInput, onChange: (e) => setApiKeyInput(e.target.value), style: { width: 300, marginRight: 8 } }), (0, jsx_runtime_1.jsx)("button", { onClick: handleSaveApiKeyLocally, children: "Use API key" }), apiKey && ((0, jsx_runtime_1.jsxs)("span", { style: { marginLeft: 8 }, children: ["Active key: ", (0, jsx_runtime_1.jsxs)("code", { children: [apiKey.slice(0, 6), "..."] })] }))] })] }), (0, jsx_runtime_1.jsxs)("nav", { style: { marginTop: 16, marginBottom: 16 }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setActiveTab('institutions'), style: { fontWeight: activeTab === 'institutions' ? 'bold' : 'normal', marginRight: 8 }, children: "Institutions & Policies" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setActiveTab('assets'), style: { fontWeight: activeTab === 'assets' ? 'bold' : 'normal', marginRight: 8 }, children: "Templates & Assets" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setActiveTab('positions'), style: { fontWeight: activeTab === 'positions' ? 'bold' : 'normal' }, children: "Positions & Ledger" })] }), (0, jsx_runtime_1.jsxs)("main", { children: [activeTab === 'institutions' && renderInstitutionsTab(), activeTab === 'assets' && renderAssetsTab(), activeTab === 'positions' && renderPositionsTab()] })] }));
}
function PolicyRow(props) {
    const [minAmount, setMinAmount] = (0, react_1.useState)(props.initialMinAmount);
    const [maxAmount, setMaxAmount] = (0, react_1.useState)(props.initialMaxAmount);
    const [allowedCurrencies, setAllowedCurrencies] = (0, react_1.useState)(props.initialAllowedCurrencies);
    const [saving, setSaving] = (0, react_1.useState)(false);
    const handleSave = async () => {
        setSaving(true);
        const position = {
            minAmount: minAmount ? Number(minAmount) : undefined,
            maxAmount: maxAmount ? Number(maxAmount) : undefined,
            allowedCurrencies: allowedCurrencies
                ? allowedCurrencies.split(',').map((c) => c.trim()).filter(Boolean)
                : undefined,
        };
        await props.onSave(props.institutionId, props.region, position);
        setSaving(false);
    };
    return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: props.region }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("input", { value: minAmount, onChange: (e) => setMinAmount(e.target.value) }) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("input", { value: maxAmount, onChange: (e) => setMaxAmount(e.target.value) }) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("input", { value: allowedCurrencies, onChange: (e) => setAllowedCurrencies(e.target.value) }) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("button", { onClick: handleSave, disabled: saving, children: saving ? 'Saving...' : 'Save' }) })] }));
}
exports.default = App;
//# sourceMappingURL=App.js.map