import React, { useState } from 'react';
import { Home, Server, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { HAConfig } from '../../types/homeassistant';
import { AIProviderConfig, AIProviderId } from '../../types/ai';
import { haService } from '../../services/haClient';
import { AIManager, DEFAULT_PROVIDERS } from '../../services/ai/aiManager';
import { StorageService } from '../../services/storage';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 State: HA Config
  const [haUrl, setHaUrl] = useState('http://homeassistant.local:8123');
  const [haToken, setHaToken] = useState('');
  const [haTesting, setHaTesting] = useState(false);
  const [haStatus, setHaStatus] = useState<{ success?: boolean; message?: string }>({});

  // Step 2 State: AI Config
  const [selectedProviderId, setSelectedProviderId] = useState<AIProviderId>('ollama');
  const [providerConfig, setProviderConfig] = useState<AIProviderConfig>(DEFAULT_PROVIDERS['ollama']);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ success?: boolean; message?: string }>({});

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

  const handleNextStep1 = async () => {
    if (!haUrl.trim() || !haToken.trim()) return;
    if (haStatus.success) {
      setStep(2);
      return;
    }
    setHaTesting(true);
    setHaStatus({});
    const res = await haService.testConnection(haUrl, haToken);
    setHaTesting(false);
    setHaStatus(res);
    if (res.success) {
      haService.setConfig({ baseUrl: haUrl, token: haToken });
      StorageService.saveHAConfig({ baseUrl: haUrl, token: haToken });
      setStep(2);
    }
  };

  const handleProviderSelect = (id: AIProviderId) => {
    setSelectedProviderId(id);
    const existing = StorageService.getAIProviders()[id] || DEFAULT_PROVIDERS[id];
    setProviderConfig(existing);
    setAiStatus({});
  };

  const handleTestAI = async () => {
    setAiTesting(true);
    setAiStatus({});
    const res = await AIManager.testProviderConnection(providerConfig);
    setAiTesting(false);
    setAiStatus(res);
    if (res.models && res.models.length > 0) {
      setProviderConfig(prev => ({ ...prev, availableModels: res.models!, selectedModel: res.models![0] }));
    }
  };

  const handleFinishOnboarding = () => {
    const providers = StorageService.getAIProviders();
    providers[selectedProviderId] = providerConfig;
    StorageService.saveAIProviders(providers);
    StorageService.saveActiveProviderId(selectedProviderId);
    onComplete();
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 30%, #1e293b 0%, #0b0f19 100%)',
      padding: '24px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '560px',
        padding: '36px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header Step Counter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#3b82f6" />
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Welcome to HAAI</h2>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{
              width: '28px', height: '6px', borderRadius: '4px',
              backgroundColor: step >= 1 ? '#3b82f6' : 'rgba(255,255,255,0.1)'
            }} />
            <span style={{
              width: '28px', height: '6px', borderRadius: '4px',
              backgroundColor: step >= 2 ? '#3b82f6' : 'rgba(255,255,255,0.1)'
            }} />
          </div>
        </div>

        {step === 1 ? (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f3f4f6', marginBottom: '6px' }}>
              Step 1: Connect Home Assistant
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
              Enter your local or Nabu Casa Home Assistant URL and a Long-Lived Access Token.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                Home Assistant Base URL
              </label>
              <input
                className="input-field"
                value={haUrl}
                onChange={e => setHaUrl(e.target.value)}
                placeholder="http://192.168.1.100:8123 or http://homeassistant.local:8123"
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                Long-Lived Access Token
              </label>
              <textarea
                className="input-field"
                rows={3}
                value={haToken}
                onChange={e => setHaToken(e.target.value)}
                placeholder="Paste your long-lived access token from HA Profile -> Long-Lived Access Tokens"
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={handleTestHA} disabled={haTesting}>
                {haTesting ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleNextStep1}
                disabled={!haUrl.trim() || !haToken.trim() || haTesting}
              >
                {haTesting ? 'Connecting...' : 'Next: Connect AI'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f3f4f6', marginBottom: '6px' }}>
              Step 2: Choose Preferred AI Provider
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
              Select local Ollama, LM Studio, Claude, GPT, Gemini, DeepSeek, or custom OpenCode.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                AI Model Provider
              </label>
              <select
                className="input-field"
                value={selectedProviderId}
                onChange={e => handleProviderSelect(e.target.value as AIProviderId)}
              >
                {Object.values(DEFAULT_PROVIDERS).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isLocal ? '(Local)' : '(Cloud)'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                API Endpoint Base URL
              </label>
              <input
                className="input-field"
                value={providerConfig.baseUrl}
                onChange={e => setProviderConfig({ ...providerConfig, baseUrl: e.target.value })}
              />
            </div>

            {!providerConfig.isLocal && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  API Key
                </label>
                <input
                  type="password"
                  className="input-field"
                  value={providerConfig.apiKey || ''}
                  onChange={e => setProviderConfig({ ...providerConfig, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                Target Model
              </label>
              <select
                className="input-field"
                value={providerConfig.selectedModel}
                onChange={e => setProviderConfig({ ...providerConfig, selectedModel: e.target.value })}
              >
                {providerConfig.availableModels.map(m => (
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

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={handleTestAI} disabled={aiTesting}>
                  {aiTesting ? 'Testing...' : 'Test AI'}
                </button>
                <button className="btn btn-primary" onClick={handleFinishOnboarding}>
                  Start Chatting <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
