import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wrench, CheckCircle, Eye, Monitor, Cpu, Copy, Check, Download, CheckSquare, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { ChatMessage, AIToolCall, AIToolResult } from '../../types/ai';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  activeModel: string;
  providerName: string;
  isSending: boolean;
  isLocalProvider?: boolean;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  onSendMessage,
  activeModel,
  providerName,
  isSending,
  isLocalProvider
}) => {
  const [input, setInput] = useState('');
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [committedTools, setCommittedTools] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    onSendMessage(input);
    setInput('');
  };

  const toggleExpand = (id: string) => {
    setExpandedResults(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleDownloadFile = (content: string, filename: string, type: string = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCommitAutomation = (tc: AIToolCall) => {
    setCommittedTools(prev => ({ ...prev, [tc.id]: true }));
    const alias = tc.arguments?.alias || 'this automation';
    onSendMessage(`Please commit and apply "${alias}" live in Home Assistant and clean up/remove any conflicting old automations.`);
  };

  return (
    <main style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#0b0f19',
      position: 'relative'
    }}>
      {/* Top Thread Info Bar */}
      <header style={{
        height: '48px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#111827'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLocalProvider ? <Monitor size={18} color="#10b981" /> : <Bot size={18} color="#3b82f6" />}
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}>Smart Home Agent</span>
        </div>
        <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            background: isLocalProvider ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: isLocalProvider ? '#34d399' : '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isLocalProvider ? <Monitor size={10} /> : <Cpu size={10} />}
            {isLocalProvider ? '[LOCAL] ' : '[CLOUD] '}{providerName}
          </span>
          <span>•</span>
          <span>{activeModel}</span>
        </div>
      </header>

      {/* Messages Thread Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            {isLocalProvider ? <Monitor size={48} color="#10b981" style={{ marginBottom: '16px', opacity: 0.8 }} /> : <Bot size={48} color="#3b82f6" style={{ marginBottom: '16px', opacity: 0.8 }} />}
            <h3 style={{ fontSize: '18px', color: '#f3f4f6', marginBottom: '8px' }}>How can HAAI help your Home Assistant today?</h3>
            <p style={{ fontSize: '14px', maxWidth: '420px', lineHeight: 1.5 }}>
              Ask to build new automations, check entity statuses, rename devices safely, generate dashboard cards, or export JSON/YAML configs.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            return (
              <div key={msg.id} className="animate-fade-in" style={{
                display: 'flex',
                gap: '14px',
                maxWidth: '850px',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}>
                {/* Avatar */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: msg.role === 'user' ? '#3b82f6' : (isLocalProvider ? '#064e3b' : '#1f293d'),
                  border: `1px solid ${msg.role === 'user' ? '#3b82f6' : (isLocalProvider ? '#10b981' : 'rgba(255, 255, 255, 0.1)')}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {msg.role === 'user' ? (
                    <User size={18} color="#fff" />
                  ) : isLocalProvider ? (
                    <Monitor size={18} color="#34d399" />
                  ) : (
                    <Bot size={18} color="#60a5fa" />
                  )}
                </div>

                {/* Message Content Bubble Container */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                  position: 'relative'
                }}>
                  {/* Header Tag above AI Response indicating Local or Cloud AI */}
                  {msg.role === 'assistant' && (
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isLocalProvider ? '#34d399' : '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isLocalProvider ? <Monitor size={12} /> : <Cpu size={12} />}
                        {isLocalProvider ? 'LOCAL MODEL' : 'CLOUD AI'} ({msg.modelUsed || activeModel})
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: copiedMsgId === msg.id ? '#10b981' : '#9ca3af',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                          title="Copy Response"
                        >
                          {copiedMsgId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedMsgId === msg.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '14px',
                    backgroundColor: msg.role === 'user' ? '#2563eb' : '#1f293d',
                    border: `1px solid ${msg.role === 'user' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: '#f3f4f6',
                    fontSize: '14px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.content}
                  </div>

                  {/* Tool Calls Render - COLLAPSIBLE DROPDOWN BY DEFAULT WITH COMMIT TO HA & ICON-ONLY DOWNLOAD BUTTON */}
                  {msg.toolCalls && msg.toolCalls.map((tc, idx) => {
                    const result = msg.toolResults ? msg.toolResults[idx] : null;
                    const isExpanded = !!expandedResults[tc.id];
                    const isCommitted = !!committedTools[tc.id];

                    return (
                      <div key={tc.id} className="glass-panel" style={{
                        borderRadius: '10px',
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        overflow: 'hidden'
                      }}>
                        {/* Collapsible Dropdown Header */}
                        <div
                          onClick={() => toggleExpand(tc.id)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Wrench size={14} color="#3b82f6" />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f3f4f6' }}>
                              Action: {tc.name} ({tc.arguments?.alias || tc.arguments?.domain || 'Details'})
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Commit to HA Button for Automations */}
                            {tc.name === 'create_or_update_automation' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCommitAutomation(tc);
                                }}
                                disabled={isCommitted}
                                className="btn btn-primary"
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '11px',
                                  backgroundColor: isCommitted ? '#10b981' : '#3b82f6'
                                }}
                              >
                                {isCommitted ? <CheckSquare size={12} /> : <Zap size={12} />}
                                {isCommitted ? 'Committed' : 'Commit to HA'}
                              </button>
                            )}

                            {/* Icon-Only Download Config Button - Placed RIGHT of Commit Button */}
                            {tc.arguments && (tc.arguments.trigger || tc.arguments.alias || tc.arguments.config) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const name = (tc.arguments.alias || 'ha_automation').toLowerCase().replace(/[^a-z0-9]/g, '_');
                                  handleDownloadFile(JSON.stringify(tc.arguments, null, 2), `${name}.json`, 'application/json');
                                }}
                                className="btn btn-secondary"
                                style={{
                                  padding: '6px',
                                  borderRadius: '6px',
                                  borderColor: 'rgba(59, 130, 246, 0.4)',
                                  color: '#60a5fa'
                                }}
                                title="Download Config File"
                              >
                                <Download size={14} />
                              </button>
                            )}

                            {/* Icon-Only Arrow Toggle */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(tc.id);
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: '#9ca3af',
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                              title={isExpanded ? 'Collapse Details' : 'Expand Details'}
                            >
                              {isExpanded ? <ChevronDown size={18} color="#60a5fa" /> : <ChevronRight size={18} color="#9ca3af" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Content Drawer */}
                        {isExpanded && (
                          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>PARAMETERS:</div>
                            <pre style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: '#9ca3af',
                              backgroundColor: '#0b0f19',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              overflowX: 'auto',
                              marginBottom: '10px'
                            }}>
                              {JSON.stringify(tc.arguments, null, 2)}
                            </pre>

                            {result && (
                              <div>
                                <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle size={12} /> HOME ASSISTANT LIVE OUTPUT:
                                </div>
                                <pre style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '12px',
                                  color: '#10b981',
                                  backgroundColor: '#061a14',
                                  border: '1px solid rgba(16, 185, 129, 0.2)',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  overflowX: 'auto',
                                  maxHeight: '220px'
                                }}>
                                  {result.diffPreview || JSON.stringify(result.result, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {isSending && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#9ca3af', fontSize: '13px' }}>
            {isLocalProvider ? <Monitor size={18} color="#10b981" /> : <Bot size={18} color="#3b82f6" />}
            <span>{isLocalProvider ? 'Local Model' : 'Cloud AI'} is querying Home Assistant...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Bottom Message Input Bar */}
      <form onSubmit={handleSubmit} style={{
        padding: '16px 20px',
        backgroundColor: '#111827',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            className="input-field"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask AI to automate, inspect, rename entities, or design dashboards..."
            disabled={isSending}
            style={{ padding: '12px 16px', fontSize: '14px' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!input.trim() || isSending}
            style={{ padding: '12px 20px' }}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </main>
  );
};
