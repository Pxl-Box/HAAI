import React from 'react';
import { Minus, Square, X, Cpu } from 'lucide-react';

interface TitlebarProps {
  haStatus: boolean;
  activeModel?: string;
}

export const Titlebar: React.FC<TitlebarProps> = ({ haStatus, activeModel }) => {
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
      WebkitAppRegion: 'drag'
    } as any}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: haStatus ? '#10b981' : '#ef4444',
            boxShadow: haStatus ? '0 0 8px #10b981' : 'none'
          }} />
          <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px', color: '#f3f4f6' }}>HAAI</span>
        </div>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>|</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Cpu size={12} color="#3b82f6" /> {activeModel || 'AI Assistant'}
        </span>
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
