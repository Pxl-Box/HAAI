import React, { useState, useEffect } from 'react';
import { Titlebar } from './components/Titlebar';
import { Onboarding } from './components/Onboarding/Onboarding';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWorkspace } from './components/Chat/ChatWorkspace';
import { SettingsModal } from './components/Settings/SettingsModal';

import { ChatThread, ChatMessage, AIProviderConfig, AIToolResult } from './types/ai';
import { HAConfig } from './types/homeassistant';

import { StorageService } from './services/storage';
import { haService } from './services/haClient';
import { AIManager, DEFAULT_PROVIDERS } from './services/ai/aiManager';
import { LocalPreProcessor } from './services/localPreProcessor';

export const App: React.FC = () => {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [haConfig, setHaConfig] = useState<HAConfig | null>(null);
  const [haConnected, setHaConnected] = useState(false);

  // Chat State
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // AI Provider State
  const [activeProviderId, setActiveProviderId] = useState<string>('ollama');
  const [activeProvider, setActiveProvider] = useState<AIProviderConfig>(DEFAULT_PROVIDERS['ollama']);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Initialize saved credentials and check onboarding
    const savedHA = StorageService.getHAConfig();
    const savedProviders = StorageService.getAIProviders();
    const savedActiveProviderId = StorageService.getActiveProviderId();
    const savedThreads = StorageService.getChatThreads();
    const savedActiveThreadId = StorageService.getActiveThreadId();

    if (savedHA && savedHA.baseUrl && savedHA.token) {
      setHaConfig(savedHA);
      haService.setConfig(savedHA);
      setHaConnected(true);
      setIsOnboarded(true);
      // Synchronize local Digital Twin Source of Truth on launch!
      LocalPreProcessor.syncDigitalTwin().catch(() => {});
    }

    const currentProv = savedProviders[savedActiveProviderId] || DEFAULT_PROVIDERS[savedActiveProviderId as keyof typeof DEFAULT_PROVIDERS] || DEFAULT_PROVIDERS.ollama;
    setActiveProviderId(savedActiveProviderId);
    setActiveProvider(currentProv);

    if (savedThreads.length > 0) {
      setThreads(savedThreads);
      setActiveThreadId(savedActiveThreadId || savedThreads[0].id);
    } else {
      // Create initial welcome chat
      const initialThread: ChatThread = {
        id: `chat_${Date.now()}`,
        title: 'Home Assistant General',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      setThreads([initialThread]);
      setActiveThreadId(initialThread.id);
      StorageService.saveChatThreads([initialThread]);
      StorageService.saveActiveThreadId(initialThread.id);
    }
  }, []);

  const handleOnboardingComplete = () => {
    const savedHA = StorageService.getHAConfig();
    if (savedHA) {
      setHaConfig(savedHA);
      haService.setConfig(savedHA);
      setHaConnected(true);
    }
    const savedActiveProviderId = StorageService.getActiveProviderId();
    const savedProviders = StorageService.getAIProviders();
    const currentProv = savedProviders[savedActiveProviderId] || DEFAULT_PROVIDERS[savedActiveProviderId as keyof typeof DEFAULT_PROVIDERS];
    setActiveProviderId(savedActiveProviderId);
    setActiveProvider(currentProv);

    setIsOnboarded(true);
  };

  const handleNewThread = (topicPreset?: string) => {
    const title = topicPreset || `Chat Thread ${threads.length + 1}`;
    const newThread: ChatThread = {
      id: `chat_${Date.now()}`,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };

    const updated = [newThread, ...threads];
    setThreads(updated);
    setActiveThreadId(newThread.id);
    StorageService.saveChatThreads(updated);
    StorageService.saveActiveThreadId(newThread.id);
  };

  const handleDeleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = threads.filter(t => t.id !== id);
    setThreads(updated);
    StorageService.saveChatThreads(updated);

    if (activeThreadId === id) {
      const nextId = updated.length > 0 ? updated[0].id : null;
      setActiveThreadId(nextId);
      if (nextId) StorageService.saveActiveThreadId(nextId);
    }
  };

  const handleSendMessage = async (content: string, imageUrls?: string[]) => {
    if (!activeThreadId) return;

    const currentThread = threads.find(t => t.id === activeThreadId);
    if (!currentThread) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      imageUrls
    };

    // Generate a smart contextual title if this is the first message in the thread
    let newTitle = currentThread.title;
    if (currentThread.messages.length === 0) {
      const cleanPrompt = content.trim().replace(/^[^a-zA-Z0-9]+/, '');
      if (cleanPrompt) {
        newTitle = cleanPrompt.length > 36 ? `${cleanPrompt.substring(0, 36).trim()}...` : cleanPrompt;
        newTitle = newTitle.charAt(0).toUpperCase() + newTitle.slice(1);
      }
    }

    const updatedMessages = [...currentThread.messages, userMsg];
    const updatedThread = { ...currentThread, title: newTitle, messages: updatedMessages, updatedAt: new Date().toISOString() };
    const updatedThreads = threads.map(t => t.id === activeThreadId ? updatedThread : t);

    setThreads(updatedThreads);
    StorageService.saveChatThreads(updatedThreads);
    setIsSending(true);

    try {
      const aiResponse = await AIManager.sendMessage(activeProvider, updatedMessages, content, imageUrls);

      // DO NOT auto-execute tool calls here. HAAI waits for the user to click "Commit to HA" in ChatWorkspace!
      let toolResults: AIToolResult[] | undefined = undefined;

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: aiResponse.responseText,
        timestamp: new Date().toISOString(),
        toolCalls: aiResponse.toolCalls,
        toolResults,
        modelUsed: activeProvider.selectedModel,
        providerId: activeProvider.id
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      const finalThread = { ...updatedThread, messages: finalMessages };
      const finalThreads = threads.map(t => t.id === activeThreadId ? finalThread : t);

      setThreads(finalThreads);
      StorageService.saveChatThreads(finalThreads);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Titlebar haStatus={haConnected} activeModel={`${activeProvider.name} (${activeProvider.selectedModel})`} />

      {!isOnboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} />
      ) : (
        <div className="app-layout">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={id => {
              setActiveThreadId(id);
              StorageService.saveActiveThreadId(id);
            }}
            onNewThread={handleNewThread}
            onDeleteThread={handleDeleteThread}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <ChatWorkspace
            messages={activeThread ? activeThread.messages : []}
            onSendMessage={handleSendMessage}
            activeModel={activeProvider.selectedModel}
            providerName={activeProvider.name}
            isSending={isSending}
            isLocalProvider={activeProvider.isLocal}
          />
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => {
          const savedActiveProviderId = StorageService.getActiveProviderId();
          const savedProviders = StorageService.getAIProviders();
          const currentProv = savedProviders[savedActiveProviderId] || DEFAULT_PROVIDERS[savedActiveProviderId as keyof typeof DEFAULT_PROVIDERS];
          setActiveProviderId(savedActiveProviderId);
          setActiveProvider(currentProv);
        }}
      />
    </div>
  );
};
