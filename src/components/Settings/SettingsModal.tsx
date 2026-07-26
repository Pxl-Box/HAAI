import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Server, Cpu, CheckCircle2, AlertCircle, RefreshCw, Brain, Plus, Trash2, 
  Edit2, Download, Upload, Search, ShieldCheck, Check, Sparkles, FileText
} from 'lucide-react';
import { HAConfig } from '../../types/homeassistant';
import { AIProviderConfig, AIProviderId } from '../../types/ai';
import { haService } from '../../services/haClient';
import { AIManager, DEFAULT_PROVIDERS } from '../../services/ai/aiManager';
import { StorageService } from '../../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved: () => void;
}

const BRAIN_CATEGORIES = [
  'Client Capabilities & Overrides',
  'Dashboard & UI Rules',
  'Device & Entity Rules',
  'Troubleshooting & Solutions',
  'General Preferences'
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved
}) => {
  const [activeTab, setActiveTab] = useState<'ha' | 'ai' | 'brain'>('ha');

  // HA State
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [haTesting, setHaTesting] = useState(false);
  const [haStatus, setHaStatus] = useState<{ success?: boolean; message?: string }>({});

  // AI State
  const [activeProviderId, setActiveProviderId] = useState<AIProviderId>('ollama');
  const [providers, setProviders] = useState<Record<string, AIProviderConfig>>({});
  const [aiTesting, setAiTesting] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ success?: boolean; message?: string }>({});

  // Brain Memory State
  const [brainMemories, setBrainMemories] = useState<string[]>([]);
  const [newMemoryCategory, setNewMemoryCategory] = useState(BRAIN_CATEGORIES[0]);
  const [newMemoryInput, setNewMemoryInput] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [brainSearch, setBrainSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const ha = StorageService.getHAConfig();
      if (ha) {
        setHaUrl(ha.baseUrl);
        setHaToken(ha.token);
      }
      const savedProviders = StorageService.getAIProviders();
      const currentActive = StorageService.getActiveProviderId() as AIProviderId;
      setProviders({ ...DEFAULT_PROVIDERS, ...savedProviders });
      setActiveProviderId(currentActive || 'ollama');

      setBrainMemories(StorageService.getBrainMemory());
    }
  }, [isOpen]);

  const handleAddMemory = () => {
    if (!newMemoryInput.trim()) return;
    const formatted = newMemoryInput.trim().startsWith('[') 
      ? newMemoryInput.trim() 
      : `[${newMemoryCategory}] ${newMemoryInput.trim()}`;

    const updated = StorageService.addBrainMemoryItem(formatted);
    setBrainMemories(updated);
    setNewMemoryInput('');
  };

  const handleStartEdit = (idx: number, fact: string) => {
    setEditingIndex(idx);
    setEditingText(fact);
  };

  const handleSaveEdit = (idx: number) => {
    if (!editingText.trim()) return;
    const updated = StorageService.updateBrainMemoryItem(idx, editingText.trim());
    setBrainMemories(updated);
    setEditingIndex(null);
    setEditingText('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  const handleRemoveMemory = (index: number) => {
    const updated = StorageService.removeBrainMemoryItem(index);
    setBrainMemories(updated);
  };

  const handleExportBrain = () => {
    const jsonStr = JSON.stringify(brainMemories, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haai_brain_memory_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBrainFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let items: string[] = [];
        if (file.name.endsWith('.json')) {
          items = JSON.parse(text);
        } else {
          items = text.split('\n').map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
        }
        if (Array.isArray(items)) {
          const updated = StorageService.importBrainMemory(items);
          setBrainMemories(updated);
        }
      } catch (err) {
        alert('Invalid file format. Please upload a valid JSON or Markdown brain file.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearBrainMemories = () => {
    if (window.confirm('Are you sure you want to erase all rules from the persistent AI Brain? This will remove all user-defined and self-learned agent capabilities.')) {
      StorageService.clearBrainMemory();
      setBrainMemories([]);
    }
  };

  const handleInsertPreset = (presetText: string) => {
    setNewMemoryInput(presetText);
  };

  if (!isOpen) return null;

  const currentProvider = providers[activeProviderId] || DEFAULT_PROVIDERS[activeProviderId];

  const handleTestHA = async () => {
    setHaTesting(true);
    setHaStatus({});
    const res = await haService.testConnection(haUrl, haToken);
    setHaTesting(false);
    setHaStatus(res);
    if (res.success) {
      haService.setConfig({ baseUrl: haUrl, token: haToken });
      StorageService.saveHAConfig({ baseUrl: haUrl, token: haToken });
    }
  };

  const handleTestAI = async () => {
    setAiTesting(true);
    setAiStatus({});
    const res = await AIManager.testProviderConnection(currentProvider);
    setAiTesting(false);
    setAiStatus(res);
    if (res.models && res.models.length > 0) {
      const updated = {
        ...currentProvider,
        availableModels: res.models,
        selectedModel: res.models[0]
      };
      setProviders(prev => ({ ...prev, [activeProviderId]: updated }));
    }
  };

  const handleSave = () => {
    StorageService.saveHAConfig({ baseUrl: haUrl, token: haToken });
    StorageService.saveAIProviders(providers);
    StorageService.saveActiveProviderId(activeProviderId);
    onSettingsSaved();
    onClose();
  };

  const filteredMemories = brainMemories.filter(m => 
    !brainSearch.trim() || m.toLowerCase().includes(brainSearch.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '720px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111827',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0b0f19'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain size={22} color="#c084fc" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6', margin: 0 }}>Application & AI Brain Settings</h2>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0d1322'
        }}>
          <button
            onClick={() => setActiveTab('ha')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'ha' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'ha' ? '#60a5fa' : '#9ca3af',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderBottom: activeTab === 'ha' ? '2px solid #3b82f6' : '2px solid transparent'
            }}
          >
            <Server size={16} /> Home Assistant Connection
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'ai' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'ai' ? '#60a5fa' : '#9ca3af',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderBottom: activeTab === 'ai' ? '2px solid #3b82f6' : '2px solid transparent'
            }}
          >
            <Cpu size={16} /> AI Provider Config
          </button>

          <button
            onClick={() => setActiveTab('brain')}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: activeTab === 'brain' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              color: activeTab === 'brain' ? '#c084fc' : '#9ca3af',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderBottom: activeTab === 'brain' ? '2px solid #c084fc' : '2px solid transparent'
            }}
          >
            <Brain size={16} /> AI Brain & Client Capabilities
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'ha' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Home Assistant Base URL
                </label>
                <input
                  className="input-field"
                  value={haUrl}
                  onChange={e => setHaUrl(e.target.value)}
                  placeholder="http://homeassistant.local:8123"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Long-Lived Access Token
                </label>
                <textarea
                  className="input-field"
                  rows={4}
                  value={haToken}
                  onChange={e => setHaToken(e.target.value)}
                  placeholder="Paste your long-lived access token"
                  style={{ resize: 'none' }}
                />
              </div>

              {haStatus.message && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: haStatus.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: haStatus.success ? '#10b981' : '#ef4444',
                  border: `1px solid ${haStatus.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {haStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {haStatus.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={handleTestHA} disabled={haTesting}>
                  {haTesting ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#1e293b', borderColor: '#3b82f6', color: '#60a5fa' }}
                  onClick={() => {
                    setHaUrl('http://localhost:8123');
                    setHaToken('test-token');
                  }}
                >
                  🧪 Load Test Sandbox Credentials
                </button>
              </div>

              <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#ef4444', marginBottom: '6px' }}>
                  Reset App Credentials & Cache
                </label>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                  Clears local Home Assistant credentials, cached Digital Twin, AI settings, and chat history. <strong>Note: Your persistent AI Brain (`brain.md`) memory is protected and will NOT be erased.</strong>
                </p>
                <button
                  type="button"
                  className="btn"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '10px 16px' }}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear credentials and reset HAAI? (Your persistent AI Brain memory will be preserved!)')) {
                      StorageService.clearAll();
                      window.location.reload();
                    }
                  }}
                >
                  🗑️ Reset App Credentials & Cache (Keep AI Brain)
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Active Provider
                </label>
                <select
                  className="input-field"
                  value={activeProviderId}
                  onChange={e => setActiveProviderId(e.target.value as AIProviderId)}
                >
                  {Object.values(providers).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isLocal ? '(Local)' : '(Cloud)'}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Base URL Endpoint
                </label>
                <input
                  className="input-field"
                  value={currentProvider.baseUrl}
                  onChange={e => setProviders({
                    ...providers,
                    [activeProviderId]: { ...currentProvider, baseUrl: e.target.value }
                  })}
                />
              </div>

              {!currentProvider.isLocal && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={currentProvider.apiKey || ''}
                    onChange={e => setProviders({
                      ...providers,
                      [activeProviderId]: { ...currentProvider, apiKey: e.target.value }
                    })}
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Selected Model
                </label>
                <select
                  className="input-field"
                  value={currentProvider.selectedModel}
                  onChange={e => setProviders({
                    ...providers,
                    [activeProviderId]: { ...currentProvider, selectedModel: e.target.value }
                  })}
                >
                  {currentProvider.availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {aiStatus.message && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: aiStatus.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: aiStatus.success ? '#10b981' : '#ef4444',
                  border: `1px solid ${aiStatus.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}>
                  {aiStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {aiStatus.message}
                </div>
              )}

              <button className="btn btn-secondary" onClick={handleTestAI} disabled={aiTesting}>
                {aiTesting ? 'Testing...' : 'Test AI & Fetch Models'}
              </button>
            </div>
          )}

          {activeTab === 'brain' && (
            <div>
              {/* Brain Banner */}
              <div style={{
                padding: '14px 18px',
                backgroundColor: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '10px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#e9d5ff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <ShieldCheck size={18} color="#c084fc" />
                  <strong>🧠 Immutable HAAI Agent Brain (`brain.md`)</strong>
                </div>
                <p style={{ marginTop: '4px', fontSize: '12px', color: '#d8b4fe', margin: 0, lineHeight: 1.5 }}>
                  This brain is <strong>permanently stored on disk</strong> and stays intact indefinitely across AI provider switches (Ollama, Gemini, Claude, DeepSeek) and database clears! You and your AI can add, edit, or troubleshoot client features, custom dashboard rules, or service bypasses here.
                </p>
              </div>

              {/* Quick Presets */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, marginBottom: '8px' }}>
                  ⚡ QUICK CLIENT IMPROVEMENT PRESETS:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleInsertPreset('When creating light card views on dashboard, format using custom:mushroom-light-card')}
                    style={presetTagStyle}
                  >
                    <Sparkles size={12} color="#c084fc" /> + Dashboard Mushroom Cards
                  </button>
                  <button
                    onClick={() => handleInsertPreset('If media player service call fails, fallback to calling script.media_bypass')}
                    style={presetTagStyle}
                  >
                    <Sparkles size={12} color="#c084fc" /> + Media Service Bypass
                  </button>
                  <button
                    onClick={() => handleInsertPreset('Always assign newly discovered Zigbee sensors to the Entrance Door area')}
                    style={presetTagStyle}
                  >
                    <Sparkles size={12} color="#c084fc" /> + Area Assignment Rule
                  </button>
                </div>
              </div>

              {/* Add New Rule Form */}
              <div style={{
                backgroundColor: '#1f2937',
                padding: '14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <select
                    className="input-field"
                    style={{ flex: '0 0 200px' }}
                    value={newMemoryCategory}
                    onChange={e => setNewMemoryCategory(e.target.value)}
                  >
                    {BRAIN_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Type new client capability, rule, or troubleshooting fix..."
                    value={newMemoryInput}
                    onChange={e => setNewMemoryInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddMemory()}
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={handleAddMemory} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} /> Log Rule to Permanent Brain
                  </button>
                </div>
              </div>

              {/* Search & Export Toolbar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <Search size={14} color="#9ca3af" />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search stored brain rules..."
                    value={brainSearch}
                    onChange={e => setBrainSearch(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleExportBrain}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Export brain memory as JSON"
                  >
                    <Download size={13} /> Export
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Import brain memory from JSON/Markdown"
                  >
                    <Upload size={13} /> Import
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".json,.md,.txt"
                    onChange={handleImportBrainFile}
                  />
                </div>
              </div>

              {/* Memory List */}
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredMemories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: '13px' }}>
                    {brainSearch ? 'No matching brain rules found for your search.' : 'No learned facts or client instructions in the brain yet. Type a rule above or let the AI log solutions as you chat!'}
                  </div>
                ) : (
                  filteredMemories.map((fact, idx) => {
                    const isEditing = editingIndex === idx;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#1f2937',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: '#f3f4f6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              className="input-field"
                              value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSaveEdit(idx)}
                              style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEdit(idx)}
                              className="btn btn-primary"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                            >
                              <Check size={14} /> Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                            <span style={{ lineHeight: 1.5, wordBreak: 'break-word' }}>• {fact}</span>
                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                              <button
                                onClick={() => handleStartEdit(idx, fact)}
                                style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
                                title="Edit rule"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleRemoveMemory(idx)}
                                style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                title="Delete rule"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Clear Brain Footer */}
              {brainMemories.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>Total Rules in Persistent Brain: {brainMemories.length}</span>
                  <button
                    onClick={handleClearBrainMemories}
                    style={{ border: 'none', background: 'transparent', color: '#ef4444', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Trash2 size={13} /> Erase All Brain Rules
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#0b0f19'
        }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

const presetTagStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: '6px',
  backgroundColor: 'rgba(168, 85, 247, 0.12)',
  border: '1px solid rgba(168, 85, 247, 0.3)',
  color: '#e9d5ff',
  fontSize: '11px',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  transition: 'all 0.15s ease'
};
