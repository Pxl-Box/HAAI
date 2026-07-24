import React from 'react';
import { 
  Plus, MessageSquare, Trash2, Settings, ChevronLeft, ChevronRight, 
  Lightbulb, Shield, Layout, Wrench
} from 'lucide-react';
import { ChatThread } from '../../types/ai';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: (topicPreset?: string) => void;
  onDeleteThread: (id: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onOpenSettings
}) => {
  return (
    <aside style={{
      width: collapsed ? '64px' : '260px',
      backgroundColor: '#111827',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      height: '100%',
      position: 'relative'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        {!collapsed && <span style={{ fontSize: '13px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.5px' }}>TOPIC CHATS</span>}
        <button
          onClick={onToggleCollapse}
          className="btn btn-secondary"
          style={{ padding: '6px', borderRadius: '6px' }}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* New Chat Button */}
      <div style={{ padding: '12px' }}>
        <button
          onClick={() => onNewThread()}
          className="btn btn-primary"
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '10px' : '10px 14px'
          }}
        >
          <Plus size={18} />
          {!collapsed && <span>New Agent Chat</span>}
        </button>
      </div>

      {/* Recommended Topic Presets */}
      {!collapsed && (
        <div style={{ padding: '0 12px 12px 12px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '8px', paddingLeft: '4px' }}>
            QUICK AGENT PRESETS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              onClick={() => onNewThread('Lighting & Ambience')}
              style={presetBtnStyle}
            >
              <Lightbulb size={12} color="#f59e0b" /> Lighting
            </button>
            <button
              onClick={() => onNewThread('Security & Cameras')}
              style={presetBtnStyle}
            >
              <Shield size={12} color="#ef4444" /> Security
            </button>
            <button
              onClick={() => onNewThread('Dashboard Layouts')}
              style={presetBtnStyle}
            >
              <Layout size={12} color="#06b6d4" /> Dashboard
            </button>
            <button
              onClick={() => onNewThread('Clean & Rename')}
              style={presetBtnStyle}
            >
              <Wrench size={12} color="#10b981" /> Refactor
            </button>
          </div>
        </div>
      )}

      {/* Chat Thread List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 8px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {threads.map(t => {
          const isActive = t.id === activeThreadId;
          return (
            <div
              key={t.id}
              onClick={() => onSelectThread(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'space-between',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                color: isActive ? '#f3f4f6' : '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <MessageSquare size={16} color={isActive ? '#3b82f6' : '#6b7280'} />
                {!collapsed && (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {t.title}
                  </span>
                )}
              </div>
              {!collapsed && (
                <button
                  onClick={e => onDeleteThread(t.id, e)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#6b7280',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex'
                  }}
                  title="Delete Chat"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Footer - Settings Icon */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between'
      }}>
        <button
          onClick={onOpenSettings}
          className="btn btn-secondary"
          style={{
            width: collapsed ? '40px' : '100%',
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
          title="Open Settings"
        >
          <Settings size={18} color="#9ca3af" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
};

const presetBtnStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: '6px',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  color: '#d1d5db',
  fontSize: '11px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
};
