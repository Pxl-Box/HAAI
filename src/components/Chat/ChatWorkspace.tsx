import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wrench, CheckCircle, Eye, Monitor, Cpu, Copy, Check, Download, CheckSquare, ChevronDown, ChevronRight, Zap, Image as ImageIcon, X } from 'lucide-react';
import { ChatMessage, AIToolCall, AIToolResult } from '../../types/ai';
import { executeHATool } from '../../services/haTools';
import { LocalPreProcessor } from '../../services/localPreProcessor';

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, imageUrls?: string[]) => void;
  activeModel: string;
  providerName: string;
  isSending: boolean;
  isLocalProvider?: boolean;
  isReadOnly?: boolean;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  messages,
  onSendMessage,
  activeModel,
  providerName,
  isSending,
  isLocalProvider,
  isReadOnly
}) => {
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({});
  const [commitStatus, setCommitStatus] = useState<Record<string, string>>({});
  const [committedTools, setCommittedTools] = useState<Record<string, boolean>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [pasteFeedback, setPasteFeedback] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // Ctrl+V paste image handler
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImages(prev => [...prev, event.target!.result as string]);
          setPasteFeedback(true);
          setTimeout(() => setPasteFeedback(false), 1500);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCopy = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const getToolCodeString = (tc: AIToolCall): string => {
    if (tc.name === 'create_or_update_automation') {
      const args = tc.arguments || {};
      const obj: any = {
        id: args.automationId || 'automation_new',
        alias: args.alias || 'Smart Automation',
        description: args.description || '',
        trigger: args.trigger || [],
        condition: args.condition || [],
        action: args.action || []
      };
      try {
        return `# Copy and paste directly into Home Assistant automations.yaml or UI YAML mode:\n${JSON.stringify(obj, null, 2)}`;
      } catch {
        return JSON.stringify(args, null, 2);
      }
    }
    return JSON.stringify({ tool: tc.name, args: tc.arguments }, null, 2);
  };

  const handleCopyToolCode = (tc: AIToolCall) => {
    const code = getToolCodeString(tc);
    navigator.clipboard.writeText(code);
    setCommitStatus(prev => ({ ...prev, [tc.id]: '✓ Copied code to clipboard!' }));
    setTimeout(() => {
      setCommitStatus(prev => ({ ...prev, [tc.id]: '' }));
    }, 2500);
  };

  const handleDownloadToolCode = (tc: AIToolCall) => {
    const code = getToolCodeString(tc);
    const filename = `${tc.name}_${tc.arguments?.alias || tc.arguments?.name || 'config'}.yaml`
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '_');
    const blob = new Blob([code], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCommitStatus(prev => ({ ...prev, [tc.id]: `✓ Downloaded ${filename}` }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleCommitAutomationDirect = async (tc: AIToolCall, skipSyncAndNotify = false) => {
    setCommittedTools(prev => ({ ...prev, [tc.id]: true }));
    setCommitStatus(prev => ({ ...prev, [tc.id]: 'Applying live update & tidying up...' }));

    try {
      const res = await executeHATool(tc);
      if (res.success) {
        setCommitStatus(prev => ({ ...prev, [tc.id]: '✓ Applied Live to Home Assistant!' }));
        if (!skipSyncAndNotify) {
          await LocalPreProcessor.syncDigitalTwin().catch(() => {});
          const alias = tc.arguments?.alias || tc.arguments?.name || tc.name || 'Automation';
          onSendMessage(`Successfully committed "${alias}" to Home Assistant and updated local Digital Twin!`);
        }
        return true;
      } else {
        setCommitStatus(prev => ({ ...prev, [tc.id]: `Error: ${res.error || 'Failed to update'}` }));
        return false;
      }
    } catch (err: any) {
      setCommitStatus(prev => ({ ...prev, [tc.id]: `Error: ${err.message || 'API Call failed'}` }));
      return false;
    }
  };

  const handleCommitAllBatch = async (toolCalls: AIToolCall[]) => {
    const uncommitted = toolCalls.filter(tc => !committedTools[tc.id]);
    if (uncommitted.length === 0) return;

    for (const tc of uncommitted) {
      await handleCommitAutomationDirect(tc, true);
    }

    await LocalPreProcessor.syncDigitalTwin().catch(() => {});
    onSendMessage(`Successfully committed all ${uncommitted.length} actions in order to Home Assistant and updated local Digital Twin!`);
  };

  const cleanMessageText = (content: string, hasToolCards: boolean) => {
    if (!hasToolCards) return content;
    return content.replace(/```(?:yaml|yml)?\s*[\s\S]*?```/gi, '').trim();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && selectedImages.length === 0) || isSending) return;
    onSendMessage(input.trim() || 'Please analyze this Home Assistant screenshot and fix any issues.', selectedImages.length > 0 ? selectedImages : undefined);
    setInput('');
    setSelectedImages([]);
  };

  return (
    <main className="chat-workspace">
      {/* Messages Header bar */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: '#111827',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isLocalProvider ? <Monitor size={20} color="#34d399" /> : <Cpu size={20} color="#60a5fa" />}
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f9fafb', margin: 0 }}>
              {isLocalProvider ? 'Local Offline Mode' : 'Cloud AI Assistant'}
            </h2>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Active Model: <strong style={{ color: isLocalProvider ? '#34d399' : '#60a5fa' }}>{activeModel}</strong> ({providerName})
            </span>
          </div>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="messages-container" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            margin: 'auto',
            maxWidth: '480px',
            padding: '40px 20px',
            backgroundColor: '#111827',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <Bot size={44} color="#3b82f6" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f3f4f6', marginBottom: '8px' }}>
              Welcome to HAAI Smart Home Assistant
            </h3>
            <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: 1.5 }}>
              Ask AI to inspect entities, build multi-room automations, analyze screenshots, organize areas, or tune your dashboards.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const hasToolCards = Boolean(msg.toolCalls && msg.toolCalls.length > 0);
            const displayText = cleanMessageText(msg.content, hasToolCards);

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%'
                }}
              >
                {/* Avatar Icon */}
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: msg.role === 'user' ? '#2563eb' : (isLocalProvider ? '#064e3b' : '#1e3a8a'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '4px'
                }}>
                  {msg.role === 'user' ? (
                    <User size={18} color="#ffffff" />
                  ) : isLocalProvider ? (
                    <Monitor size={18} color="#34d399" />
                  ) : (
                    <Bot size={18} color="#60a5fa" />
                  )}
                </div>

                {/* Message Content Container */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  width: '100%',
                  position: 'relative'
                }}>
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
                          gap: '4px'
                        }}
                      >
                        {copiedMsgId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedMsgId === msg.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  )}

                  {/* Render User Uploaded Screenshots */}
                  {msg.imageUrls && msg.imageUrls.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      {msg.imageUrls.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt="Uploaded Screenshot"
                          style={{
                            maxWidth: '280px',
                            maxHeight: '200px',
                            borderRadius: '10px',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            objectFit: 'cover'
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Text Bubble */}
                  {displayText && (
                    <div style={{
                      padding: '14px 18px',
                      borderRadius: '14px',
                      backgroundColor: msg.role === 'user' ? '#2563eb' : '#1f293d',
                      border: `1px solid ${msg.role === 'user' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                      color: '#f3f4f6',
                      fontSize: '14px',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {displayText}
                    </div>
                  )}

                  {/* Render 1-Click Action Tool Cards */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (() => {
                    const uncommittedCount = msg.toolCalls.filter(tc => !committedTools[tc.id]).length;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        {msg.toolCalls.length > 1 && uncommittedCount > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 16px',
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '10px'
                          }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa' }}>
                              📋 {uncommittedCount} of {msg.toolCalls.length} Action{msg.toolCalls.length !== 1 ? 's' : ''} Pending Review
                            </div>
                            <button
                              onClick={() => handleCommitAllBatch(msg.toolCalls!)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: '#3b82f6',
                                color: '#ffffff',
                                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
                              }}
                            >
                              <Zap size={14} fill="#ffffff" />
                              ⚡ Commit All ({uncommittedCount}) in Order
                            </button>
                          </div>
                        )}
                        {msg.toolCalls.map((tc) => {
                          const statusText = commitStatus[tc.id];
                          const isCommitted = Boolean(committedTools[tc.id]);

                          return (
                            <div
                              key={tc.id}
                              style={{
                                backgroundColor: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '12px',
                                overflow: 'hidden'
                              }}
                            >
                        <div style={{
                          padding: '12px 16px',
                          backgroundColor: '#1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                            <Wrench size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              Action: {tc.name} ({tc.arguments?.alias || tc.arguments?.automationId || 'Home Assistant'})
                            </span>
                            {/* Validation badge */}
                            {tc._validation && !tc._validation.isClean && (
                              <span
                                title={`${tc._validation.unknownEntities.length} unknown entity ID(s) detected — expand to see details`}
                                style={{
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(251, 191, 36, 0.15)',
                                  border: '1px solid rgba(251, 191, 36, 0.4)',
                                  color: '#fbbf24',
                                  cursor: 'default'
                                }}
                              >
                                ⚠ {tc._validation.unknownEntities.length} unknown {tc._validation.unknownEntities.length === 1 ? 'entity' : 'entities'}
                              </span>
                            )}
                            {tc._validation?.isClean && tc._validation.checkedEntityCount > 0 && (
                              <span
                                title={`All ${tc._validation.checkedEntityCount} entity ID(s) verified against your Digital Twin`}
                                style={{
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(52, 211, 153, 0.1)',
                                  border: '1px solid rgba(52, 211, 153, 0.3)',
                                  color: '#34d399',
                                  cursor: 'default'
                                }}
                              >
                                ✓ verified
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isReadOnly ? (
                              <>
                                <button
                                  onClick={() => handleCopyToolCode(tc)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                    color: '#fbbf24',
                                    cursor: 'pointer'
                                  }}
                                  title="Copy YAML / JSON code to clipboard for manual paste into Home Assistant"
                                >
                                  <Copy size={13} /> Copy Code
                                </button>

                                <button
                                  onClick={() => handleDownloadToolCode(tc)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                    cursor: 'pointer'
                                  }}
                                  title="Download configuration file for manual import"
                                >
                                  <Download size={13} /> Download
                                </button>
                              </>
                            ) : (
                              /* 1-Click Commit Button */
                              <button
                                onClick={() => handleCommitAutomationDirect(tc)}
                                disabled={isCommitted}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '6px 14px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  border: 'none',
                                  cursor: isCommitted ? 'default' : 'pointer',
                                  backgroundColor: isCommitted ? '#065f46' : '#2563eb',
                                  color: '#ffffff'
                                }}
                              >
                                {isCommitted ? <CheckCircle size={14} /> : <Zap size={14} />}
                                {isCommitted ? '✓ Committed' : '⚡ Commit to HA'}
                              </button>
                            )}

                            <button
                              onClick={() => setExpandedResults(prev => ({ ...prev, [tc.id]: !prev[tc.id] }))}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px'
                              }}
                            >
                              {expandedResults[tc.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Validation warning panel */}
                        {tc._validation && !tc._validation.isClean && (
                          <div style={{
                            padding: '10px 16px',
                            backgroundColor: 'rgba(251, 191, 36, 0.07)',
                            borderTop: '1px solid rgba(251, 191, 36, 0.2)',
                            borderBottom: '1px solid rgba(251, 191, 36, 0.2)'
                          }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', marginBottom: '6px' }}>
                              ⚠ Fact-Check: {tc._validation.unknownEntities.length} entity ID(s) not found in your Digital Twin
                            </div>
                            {tc._validation.unknownEntities.map((w, i) => (
                              <div key={i} style={{ fontSize: '11px', color: '#f59e0b', marginBottom: '3px', fontFamily: 'var(--font-mono)' }}>
                                <span style={{ color: '#fca5a5' }}>{w.entityId}</span>
                                <span style={{ color: '#64748b' }}> used in {w.usedIn}</span>
                                {w.suggestion && (
                                  <span style={{ color: '#94a3b8' }}> — did you mean <span style={{ color: '#67e8f9' }}>{w.suggestion}</span>?</span>
                                )}
                              </div>
                            ))}
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                              Review before committing. You can still commit as-is — Home Assistant will flag missing entities on its end.
                            </div>
                          </div>
                        )}


                        {statusText && (
                          <div style={{
                            padding: '8px 16px',
                            backgroundColor: '#0f172a',
                            fontSize: '12px',
                            color: statusText.includes('✓') ? '#34d399' : '#f87171',
                            fontWeight: 500
                          }}>
                            {statusText}
                          </div>
                        )}

                        {expandedResults[tc.id] && (
                          <div style={{ padding: '14px 16px', borderTop: '1px solid #1e293b' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', fontWeight: 600 }}>
                              Parameters / YAML Data
                            </div>
                            <pre style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: '#cbd5e1',
                              backgroundColor: '#020617',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              overflowX: 'auto',
                              maxHeight: '300px'
                            }}>
                              {JSON.stringify(tc.arguments, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
                </div>
              </div>
            );
          })
        )}

        {isSending && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#9ca3af', fontSize: '13px' }}>
            {isLocalProvider ? <Monitor size={18} color="#10b981" /> : <Bot size={18} color="#3b82f6" />}
            <span>{isLocalProvider ? 'Local Model' : 'Cloud AI'} is analyzing Home Assistant...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Selected Image Thumbnails Preview Bar */}
      {selectedImages.length > 0 && (
        <div style={{
          padding: '10px 20px 0 20px',
          backgroundColor: '#111827',
          display: 'flex',
          gap: '10px',
          overflowX: 'auto'
        }}>
          {selectedImages.map((img, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={img}
                alt="Selected preview"
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '1px solid #3b82f6'
                }}
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Message Input Bar with Screenshot Upload Button */}
      <form onSubmit={handleSubmit} style={{
        padding: '16px 20px',
        backgroundColor: '#111827',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={handleImageSelect}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            title="Upload screenshot of Home Assistant UI or Trace log"
            style={{ padding: '12px 14px', backgroundColor: '#1e293b' }}
          >
            <ImageIcon size={18} color="#94a3b8" />
          </button>

          <input
            className="input-field"
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder={pasteFeedback ? '📋 Image pasted! Add a message or send directly...' : 'Ask AI to automate, fix a screenshot error, inspect, or build... (Ctrl+V to paste images)'}
            disabled={isSending}
            style={{
              padding: '12px 16px',
              fontSize: '14px',
              flex: 1,
              borderColor: pasteFeedback ? '#3b82f6' : undefined,
              boxShadow: pasteFeedback ? '0 0 0 2px rgba(59, 130, 246, 0.35)' : undefined,
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
            }}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={(!input.trim() && selectedImages.length === 0) || isSending}
            style={{ padding: '12px 20px' }}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </main>
  );
};
