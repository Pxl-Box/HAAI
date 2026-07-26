import React from 'react';
import { Minus, Square, X, Cpu, RefreshCw, ShieldCheck, Lock } from 'lucide-react';

interface TitlebarProps {
  haStatus: boolean;
  activeModel?: string;
  isReadOnly: boolean;
  onToggleReadOnly: () => void;
  onSyncDigitalTwin: () => void;
  isSyncingTwin: boolean;
  syncSuccessMessage?: string | null;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  haStatus,
  activeModel,
  isReadOnly,
  onToggleReadOnly,
  onSyncDigitalTwin,
  isSyncingTwin,
  syncSuccessMessage
}) => {
  const handleMinimize = () => (window as any).electronAPI?.minimizeWindow();
  const handleMaximize = () => (window as any).electronAPI?.maximizeWindow();
  const handleClose = () => (window as any).electronAPI?.closeWindow();

  return (
    <header style={{
      height: '38px',
      backgroundColor: '#090d16',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: '14px',
      paddingRight: '4px',
      WebkitAppRegion: 'drag'
    } as any}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', WebkitAppRegion: 'no-drag' } as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: haStatus ? '#10b981' : '#ef4444',
            boxShadow: haStatus ? '0 0 8px #10b981' : 'none'
          }} />
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', color: '#f3f4f6' }}>HAAI</span>
        </div>
        <span style={{ fontSize: '11px', color: '#4b5563' }}>|</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Cpu size={12} color="#3b82f6" /> {activeModel || 'AI Assistant'}
        </span>

        {/* Sync Digital Twin Source of Truth Button */}
        <button
          onClick={onSyncDigitalTwin}
          disabled={isSyncingTwin}
          title="Clear cached data and re-import live Areas, Floors, Helpers, Entities, Automations, Dashboards, Devices & Integrations from Home Assistant"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            color: '#38bdf8',
            cursor: isSyncingTwin ? 'wait' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <RefreshCw size={12} className={isSyncingTwin ? 'spin-icon' : ''} />
          {isSyncingTwin ? 'Resyncing Twin...' : 'Sync Digital Twin'}
        </button>

        {syncSuccessMessage && (
          <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, animation: 'fadeIn 0.2s ease' }}>
            ✓ {syncSuccessMessage}
          </span>
        )}

        {/* Manual Read-Only Mode Toggle */}
        <button
          onClick={onToggleReadOnly}
          title={isReadOnly ? 'Manual Mode Active: Direct HA live writes are disabled. AI code is copied/downloaded manually.' : 'Switch to Manual Mode: Prevents direct writes to Home Assistant and provides copy/download options.'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 700,
            borderRadius: '6px',
            border: `1px solid ${isReadOnly ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            backgroundColor: isReadOnly ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            color: isReadOnly ? '#fbbf24' : '#9ca3af',
            cursor: 'pointer'
          }}
        >
          {isReadOnly ? <Lock size={12} color="#fbbf24" /> : <ShieldCheck size={12} />}
          {isReadOnly ? 'Manual Mode (Read-Only)' : 'Live Commit Mode'}
        </button>
      </div>

      <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' } as any}>
        <button onClick={handleMinimize} style={btnStyle} title="Minimize">
          <Minus size={14} />
        </button>
        <button onClick={handleMaximize} style={btnStyle} title="Maximize">
          <Square size={12} />
        </button>
        <button onClick={handleClose} style={btnStyle} title="Close">
          <X size={14} />
        </button>
      </div>
    </header>
  );
};

const btnStyle: React.CSSProperties = {
  width: '44px',
  height: '100%',
  border: 'none',
  background: 'transparent',
  color: '#9ca3af',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
};
