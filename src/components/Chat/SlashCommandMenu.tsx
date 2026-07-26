import React, { useMemo } from 'react';
import { Terminal, Sparkles, ChevronRight, Zap } from 'lucide-react';
import { SlashCommandService } from '../../services/slashCommandService';
import { SlashCommand, SubCommand } from '../../types/slashCommands';

interface SlashCommandMenuProps {
  input: string;
  onSelectCommand: (commandText: string) => void;
  selectedIndex: number;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  input,
  onSelectCommand,
  selectedIndex
}) => {
  // Determine mode: Main command selection vs Sub-command selection
  const { isSubMode, activeMainCmd, items } = useMemo(() => {
    const trimmed = input.trimStart();
    if (!trimmed.startsWith('/')) {
      return { isSubMode: false, activeMainCmd: null, items: [] };
    }

    const allCmds = SlashCommandService.getAllCommands();
    const query = trimmed.slice(1);
    const spaceIndex = query.indexOf(' ');

    if (spaceIndex === -1) {
      // Main command filtering mode
      const filter = query.toLowerCase();
      const matched = allCmds.filter(c => 
        c.name.toLowerCase().includes(filter) || 
        c.description.toLowerCase().includes(filter)
      );

      const list = matched.map(c => ({
        type: 'main' as const,
        id: c.id,
        title: `/${c.name}`,
        subtitle: c.description,
        isCustom: c.isCustom,
        insertText: `/${c.name} `
      }));

      return { isSubMode: false, activeMainCmd: null, items: list };
    } else {
      // Sub-command filtering mode
      const mainName = query.slice(0, spaceIndex).toLowerCase();
      const subQuery = query.slice(spaceIndex + 1).toLowerCase();

      const mainCmd = allCmds.find(c => c.name.toLowerCase() === mainName);
      if (!mainCmd || !mainCmd.subCommands || mainCmd.subCommands.length === 0) {
        return { isSubMode: false, activeMainCmd: null, items: [] };
      }

      const matchedSubs = mainCmd.subCommands.filter(s =>
        s.name.toLowerCase().includes(subQuery) ||
        s.description.toLowerCase().includes(subQuery)
      );

      const list = matchedSubs.map(s => ({
        type: 'sub' as const,
        id: `${mainCmd.name}_${s.name}`,
        title: s.name,
        subtitle: s.description,
        insertText: `/${mainCmd.name} ${s.name} `
      }));

      return { isSubMode: true, activeMainCmd: mainCmd, items: list };
    }
  }, [input]);

  if (items.length === 0) return null;

  const currentActiveIdx = Math.min(selectedIndex, items.length - 1);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '20px',
        right: '20px',
        marginBottom: '8px',
        backgroundColor: '#0f172a',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
        zIndex: 50,
        maxHeight: '280px',
        overflowY: 'auto',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Menu Header / Helper Label */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          fontSize: '11px',
          fontWeight: 600,
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Terminal size={13} color="#3b82f6" />
          <span>
            {isSubMode && activeMainCmd
              ? `Sub-Commands for /${activeMainCmd.name}`
              : 'Slash Commands Reference'}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'none' }}>
          Use ↑ ↓ to navigate, Tab/Enter to select
        </span>
      </div>

      {/* Items list */}
      <div style={{ padding: '6px' }}>
        {items.map((item, idx) => {
          const isSelected = idx === currentActiveIdx;
          return (
            <div
              key={item.id}
              onClick={() => onSelectCommand(item.insertText)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: isSelected ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {item.type === 'main' ? (
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Zap size={14} color="#60a5fa" />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <ChevronRight size={14} color="#34d399" />
                  </div>
                )}

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: isSelected ? '#ffffff' : '#e2e8f0',
                        fontFamily: 'monospace'
                      }}
                    >
                      {item.title}
                    </span>
                    {item.type === 'main' && item.isCustom && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(168, 85, 247, 0.2)',
                          color: '#c084fc',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          fontWeight: 500
                        }}
                      >
                        Custom
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: isSelected ? '#cbd5e1' : '#94a3b8',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px'
                    }}
                  >
                    {item.subtitle}
                  </div>
                </div>
              </div>

              {isSelected && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#60a5fa',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    flexShrink: 0
                  }}
                >
                  Press Enter ↵
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
