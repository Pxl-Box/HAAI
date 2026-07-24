import React, { useState, useEffect } from 'react';
import { X, Server, Cpu, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved
}) => {
  const [activeTab, setActiveTab] = useState<'ha' | 'ai'>('ha');

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
    }
  }, [isOpen]);

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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#111827',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f3f4f6' }}>Application Settings</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundColor: '#0b0f19'
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
              gap: '8px'
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
              gap: '8px'
            }}
          >
            <Cpu size={16} /> AI Model & Provider Setup
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'ha' ? (
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

              <button className="btn btn-secondary" onClick={handleTestHA} disabled={haTesting}>
                {haTesting ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          ) : (
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
