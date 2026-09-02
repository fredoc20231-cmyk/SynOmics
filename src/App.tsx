/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  SynapticProtein, 
  SynGOOntologyNode, 
  BioProtocol, 
  SynOmicsToolDeclaration, 
  SynOmicsAgentRun,
  AppOperatingMode,
  ChatSession,
  ChatMessage,
  ChatActionItem,
  UploadedBioFile
} from './types';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { BasicChatMode } from './components/BasicChatMode';
import { AdvancedReasoningMode } from './components/AdvancedReasoningMode';
import { DiscoveryMode } from './components/DiscoveryMode';
import { DrugDiscoveryMode } from './components/DrugDiscoveryMode';
import { WorkspaceMode } from './components/WorkspaceMode';
import { FileUploadModal } from './components/FileUploadModal';
import { LegalDisclaimerModal } from './components/LegalDisclaimerModal';
import { LegalFooter } from './components/LegalFooter';
import { ProteinModal } from './components/ProteinModal';
import { ComprehensiveAnalysisHubModal, AnalysisCatalogItem } from './components/ComprehensiveAnalysisHubModal';
import { VoiceInteractionModal } from './components/VoiceInteractionModal';
import { 
  VoiceSettings, 
  DEFAULT_VOICE_SETTINGS, 
  speakText, 
  stopSpeaking,
  subscribeToSpeechState,
  subscribeToListeningState
} from './lib/voice-service';
import { INITIAL_CHAT_SESSIONS } from './data/defaultSessions';
import { exportScientificReport, ReportExportFormat } from './utils/reportExporter';
import { ReportExportModal } from './components/ReportExportModal';
import { 
  auth, 
  signInWithGoogle, 
  signOutUser, 
  saveAnalysisSessionToCloud, 
  loadAnalysisSessionsFromCloud, 
  testFirestoreConnection 
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Firebase Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Operating mode & navigation state
  const [currentMode, setCurrentMode] = useState<AppOperatingMode>('basic');
  const [selectedModel, setSelectedModel] = useState('synomics_7');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Voice Listening and Speech Synthesis state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // New Analysis Catalog Modal
  const [isNewAnalysisModalOpen, setIsNewAnalysisModalOpen] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>(INITIAL_CHAT_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string>(INITIAL_CHAT_SESSIONS[0]?.id || 'session-1');

  // Catalog initial selected analysis
  const [catalogInitialAnalysisId, setCatalogInitialAnalysisId] = useState<string | undefined>(undefined);

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedBioFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<UploadedBioFile[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Legal & Export Modals
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Knowledge base state
  const [proteins, setProteins] = useState<SynapticProtein[]>([]);
  const [syngoTree, setSyngoTree] = useState<SynGOOntologyNode[]>([]);
  const [protocols, setProtocols] = useState<BioProtocol[]>([]);
  const [tools, setTools] = useState<SynOmicsToolDeclaration[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // SynOmics Reasoning Agent state
  const [currentRun, setCurrentRun] = useState<SynOmicsAgentRun | null>(null);
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  // Selected protein for modal & 3D target
  const [selectedProtein, setSelectedProtein] = useState<SynapticProtein | null>(null);
  const [targetProteinSymbol, setTargetProteinSymbol] = useState<string>('TP53');

  // Sync speech and listening states globally
  useEffect(() => {
    const unsubSpeech = subscribeToSpeechState((speaking) => {
      setIsSpeaking(speaking);
    });
    const unsubListen = subscribeToListeningState((listening) => {
      setIsListening(listening);
    });
    return () => {
      unsubSpeech();
      unsubListen();
      stopSpeaking();
    };
  }, []);

  // Firebase Auth listener and Cloud sync
  useEffect(() => {
    testFirestoreConnection();
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const cloudSessions = await loadAnalysisSessionsFromCloud(user.uid);
          if (cloudSessions && cloudSessions.length > 0) {
            setSessions(prev => {
              const existingIds = new Set(prev.map(s => s.id));
              const newSessions: ChatSession[] = (cloudSessions as any[]).map(cs => ({
                id: cs.id,
                title: cs.title || 'Saved Cloud Session',
                createdAt: cs.createdAt || new Date().toISOString(),
                updatedAt: cs.updatedAt || new Date().toISOString(),
                messages: [{
                  id: `msg-${cs.id}-1`,
                  role: 'user' as const,
                  content: cs.query || '',
                  timestamp: cs.createdAt || new Date().toISOString()
                }, {
                  id: `msg-${cs.id}-2`,
                  role: 'assistant' as const,
                  content: cs.summary || 'Session retrieved from cloud.',
                  timestamp: cs.updatedAt || new Date().toISOString()
                }]
              })).filter(s => !existingIds.has(s.id));

              return [...newSessions, ...prev];
            });
          }
        } catch (err) {
          console.warn('Could not load user sessions from Firebase:', err);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync theme with HTML document class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Fetch initial knowledge base
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingData(true);
        const [proteinsRes, syngoRes, protocolsRes, toolsRes] = await Promise.all([
          fetch('/api/synapse/proteins'),
          fetch('/api/synapse/syngo-tree'),
          fetch('/api/synapse/protocols'),
          fetch('/api/synomics/tools')
        ]);

        const [proteinsData, syngoData, protocolsData, toolsData] = await Promise.all([
          proteinsRes.json(),
          syngoRes.json(),
          protocolsRes.json(),
          toolsRes.json()
        ]);

        setProteins(proteinsData.proteins || []);
        setSyngoTree(syngoData.tree || []);
        setProtocols(protocolsData.protocols || []);
        setTools(toolsData.tools || []);
      } catch (err: any) {
        console.error('Failed to load SynOmics data:', err);
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // Create new session
  const handleNewSession = (mode: AppOperatingMode = 'basic') => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Scientific Inquiry',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setCurrentMode(mode);
  };

  // Delete session
  const handleDeleteSession = (id: string) => {
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    if (activeSessionId === id && remaining.length > 0) {
      setActiveSessionId(remaining[0].id);
    }
  };

  // Send message in Basic or Chat mode
  const handleSendMessage = async (content: string, attachedFiles?: UploadedBioFile[]) => {
    if (!content.trim() && (!attachedFiles || attachedFiles.length === 0)) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachedFiles
    };

    // Update active session messages
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isFirstMessage = s.messages.length === 0;
        const newTitle = isFirstMessage 
          ? content.slice(0, 36) + (content.length > 36 ? '...' : '') 
          : s.title;

        return {
          ...s,
          title: newTitle,
          updatedAt: new Date().toISOString(),
          messages: [...s.messages, userMessage]
        };
      }
      return s;
    }));

    // Clear staged files
    setStagedFiles([]);

    // Execute agent run
    setIsAgentRunning(true);

    try {
      // Parallel fetch: structured scientific chat + SynOmics agent reasoning loop
      const [chatRes, agentRes] = await Promise.allSettled([
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: content,
            files: attachedFiles,
            model: selectedModel
          })
        }),
        fetch('/api/synomics/agent-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: content,
            mode: 'autonomous',
            files: attachedFiles,
            model: selectedModel
          })
        })
      ]);

      let assistantMessage: ChatMessage | null = null;

      if (chatRes.status === 'fulfilled') {
        const chatData = await chatRes.value.json();
        if (chatData.message) {
          assistantMessage = chatData.message;
        }
      }

      if (agentRes.status === 'fulfilled') {
        const agentData = await agentRes.value.json();
        if (agentData.run) {
          setCurrentRun(agentData.run);
        }
      }

      if (!assistantMessage) {
        // Honest failure state — never fabricate analysis results. The AI
        // backend returned no message (e.g. missing GEMINI_API_KEY or an API
        // error). Tell the user plainly instead of inventing an outcome.
        assistantMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `### Request could not be completed\n\nThe AI backend did not return a response for your query. No analysis was performed.\n\n**Common causes**\n- \`GEMINI_API_KEY\` is not configured on the server.\n- A transient network or API error occurred.\n\nPlease verify the server configuration and try again. If you attached data, you can also run a specific tool directly from the Analysis Hub, which uses the local computation engine and does not require the AI key.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }

      const finalMsg = assistantMessage;

      // Auto-speak response if configured by user
      if (voiceSettings.autoSpeakResponses && finalMsg.content) {
        speakText(finalMsg.content, voiceSettings).catch(console.error);
      }

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages, finalMsg]
          };
        }
        return s;
      }));

    } catch (err) {
      console.error('Agent chat error:', err);
      const fallbackMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `### Request failed\n\nA network or server error occurred while contacting the analysis backend, so no results were produced.\n\n\`${err instanceof Error ? err.message : String(err)}\`\n\nPlease check that the server is running and try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (voiceSettings.autoSpeakResponses) {
        speakText(fallbackMsg.content, voiceSettings).catch(console.error);
      }

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages, fallbackMsg]
          };
        }
        return s;
      }));
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Execute interactive actions suggested by the agent
  const handleExecuteAction = (action: ChatActionItem) => {
    if (action.mode) {
      setCurrentMode(action.mode);
    }
    if (action.targetGene) {
      setTargetProteinSymbol(action.targetGene);
    }
    if (action.query) {
      handleSendMessage(action.query);
    }
  };

  // Launch analysis directly from uploaded dataset
  const handleLaunchDatasetPipeline = (files: UploadedBioFile[], config: any) => {
    setUploadedFiles(prev => [...prev, ...files]);
    setStagedFiles(prev => [...prev, ...files]);

    const primaryFile = files[0];
    const groupsSummary = config.groups
      ? config.groups.map((g: any) => `${g.name} (${g.designation}, n=${g.count})`).join(', ')
      : 'Control vs Treated';
    const pipelineName = config.pipeline || 'Multi-Omics Pipeline Analysis';
    const organism = config.organism || 'Homo sapiens (GRCh38)';
    const pairing = config.pairing || 'paired-end';

    const promptText = `Execute bioinformatics pipeline: **${pipelineName}** on dataset \`${primaryFile.name}\` (${primaryFile.type}).\n\n**Experimental Groups:** ${groupsSummary}\n**Organism:** ${organism}\n**Pairing:** ${pairing}${config.notes ? `\n**Study Notes:** ${config.notes}` : ''}\n\nPerform full quality control, normalization, differential statistical modeling, and generate high-resolution interactive plots.`;

    setCurrentMode('basic');
    handleSendMessage(promptText, files);
  };

  // Start a new specialized analysis session from catalog
  const handleLaunchCatalogAnalysis = (
    item: AnalysisCatalogItem,
    customParams: Record<string, any>,
    selectedGene: string
  ) => {
    const newSessionId = `session-${Date.now()}`;
    const initialMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: `### [Section ${item.categoryNumber}] ${item.title}\n\n**Category:** ${item.category}\n**Target Gene / Locus:** \`${selectedGene}\`\n**Pipeline Tools:** ${item.tools.join(', ')}\n\n${item.description}\n\n#### Selected Parameters\n\`\`\`json\n${JSON.stringify({ ...customParams, gene: selectedGene }, null, 2)}\n\`\`\`\n\nThis analysis is configured but has **not** been run yet. Send a message describing your data and question to execute it, attach a dataset, or open a specific tool in the Analysis Hub to compute results with the local engine.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      molecularTarget: selectedGene,
      visualizationHint: item.targetMode === 'discovery' ? 'volcano' : 'pca',
      suggestedActions: [
        { id: 'act-1', label: `Inspect 3D AlphaFold Docking for ${selectedGene}`, icon: 'structure', mode: 'workspace', targetGene: selectedGene },
        { id: 'act-2', label: 'Explore Volcano & Single-Cell Clusters', icon: 'volcano', mode: 'discovery' },
        { id: 'act-3', label: 'Launch Autonomous Co-Scientist Loop', icon: 'sparkles', mode: 'advanced' }
      ]
    };

    const newSession: ChatSession = {
      id: newSessionId,
      title: `[${item.categoryNumber}] ${item.title.split('(')[0].trim()} (${selectedGene})`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [initialMessage],
      category: 'bioinformatics'
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSessionId);
    setTargetProteinSymbol(selectedGene);

    if (item.targetMode) {
      setCurrentMode(item.targetMode);
    }
  };

  // Start a new specialized analysis session
  const handleStartNewAnalysis = (analysisType: string) => {
    setCatalogInitialAnalysisId(analysisType);
    setIsNewAnalysisModalOpen(true);
  };

  // Run inquiry from Advanced or Workspace mode
  const handleRunAgentInquiry = async (
    query: string,
    mode: 'autonomous' | 'interactive' | 'protocol_designer' | 'variant_prioritizer' = 'autonomous'
  ) => {
    setIsAgentRunning(true);
    try {
      const res = await fetch('/api/synomics/agent-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode, model: selectedModel })
      });
      const data = await res.json();
      if (data.status === 'success' && data.run) {
        setCurrentRun(data.run);
      }
    } catch (err) {
      console.error('Inquiry error:', err);
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Handle Preset Query Selection from Top Header / Presets
  const handleSelectPresetQuery = (query: string) => {
    // Domain-agnostic gene/target detection: match any loaded entity whose
    // symbol appears in the query; otherwise pick the first gene-symbol-like
    // token. No hardcoded (neuroscience) gene list.
    const upper = query.toUpperCase();
    let gene = '';
    const matched = proteins.find(p => {
      const sym = p.geneSymbol?.toUpperCase();
      return sym && new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(upper);
    });
    if (matched) {
      gene = matched.geneSymbol;
    } else {
      const token = upper.match(/\b[A-Z][A-Z0-9]{1,7}\d?\b/);
      if (token) gene = token[0];
    }

    if (gene) setTargetProteinSymbol(gene);
    const found = gene ? proteins.find(p => p.geneSymbol.toUpperCase() === gene.toUpperCase()) : undefined;
    if (found) {
      setSelectedProtein(found);
    }

    if (currentMode === 'basic') {
      handleSendMessage(query);
    } else {
      handleRunAgentInquiry(query);
      handleSendMessage(query);
    }
  };

  // Handle Export Report (Multi-Format PDF, DOCX, HTML, JSON, TEXT)
  const handleExportReport = (format?: ReportExportFormat) => {
    if (!format) {
      setIsExportModalOpen(true);
      return;
    }

    if (currentRun) {
      exportScientificReport(currentRun, format, {
        sessionTitle: activeSession?.title || 'SynOmics Investigation'
      });
    } else {
      // Fallback for session chat if no multi-agent run exists
      const reportData = {
        title: 'SynOmics Investigation Summary',
        timestamp: new Date().toISOString(),
        activeSessionTitle: activeSession?.title || 'Investigation',
        messagesCount: activeSession?.messages.length || 0
      };

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `synomics_report_${Date.now()}.json`;
        a.click();
      } else {
        let text = `# SynOmics Investigation Summary\nSession: ${activeSession?.title || 'Investigation'}\n\n`;
        activeSession?.messages.forEach((m) => {
          text += `[${m.role.toUpperCase()}] ${m.timestamp}\n${m.content}\n\n`;
        });
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `synomics_report_${Date.now()}.txt`;
        a.click();
      }
    }
  };

  // Open 3D viewer for a specific molecular target
  const handleOpen3DViewerForTarget = (geneSymbol: string) => {
    setTargetProteinSymbol(geneSymbol);
    setCurrentMode('workspace');
  };

  // Select protein and inspect modal
  const handleSelectProtein = (p: SynapticProtein) => {
    setSelectedProtein(p);
  };

  return (
    <div className="h-screen w-full overflow-hidden flex bg-[#FAF9F5] dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F8FAFC] font-sans antialiased">
      {/* 1. Left Collapsible Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setCurrentMode('basic');
        }}
        onNewSession={() => handleNewSession('basic')}
        onNewAnalysis={() => handleNewSession('basic')}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onRenameSession={(id, newTitle) => {
          setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
        }}
        onDeleteSession={handleDeleteSession}
        onDuplicateSession={(id) => {
          const target = sessions.find(s => s.id === id);
          if (target) {
            const duplicated: ChatSession = {
              ...target,
              id: `session-${Date.now()}`,
              title: `${target.title} (Copy)`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            setSessions(prev => [duplicated, ...prev]);
            setActiveSessionId(duplicated.id);
          }
        }}
        onArchiveSession={(id) => {
          setSessions(prev => prev.map(s => s.id === id ? { ...s, isArchived: true } : s));
        }}
        isDarkMode={theme === 'dark'}
        onToggleDarkMode={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onOpenLegalModal={() => setIsLegalModalOpen(true)}
        isCollapsed={!isSidebarOpen}
        onToggleCollapse={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* 2. Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Sticky Top Header */}
        <TopHeader
          currentMode={currentMode}
          onModeChange={setCurrentMode}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onSelectPresetQuery={handleSelectPresetQuery}
          onExportReport={handleExportReport}
          isAgentRunning={isAgentRunning}
          totalProteinsCount={proteins.length}
          onNewSession={() => handleNewSession('basic')}
          onOpenFileUploadModal={() => setIsUploadModalOpen(true)}
          onOpenNewAnalysisModal={() => handleNewSession('basic')}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          isSpeaking={isSpeaking}
          isListening={isListening}
          isDarkMode={theme === 'dark'}
          onToggleDarkMode={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        />

        {/* Dynamic Operating Mode Container */}
        <main className="flex-1 overflow-hidden relative">
          {currentMode === 'basic' && (
            <BasicChatMode
              messages={activeSession?.messages || []}
              onSendMessage={handleSendMessage}
              isRunning={isAgentRunning}
              onOpen3DViewerForTarget={handleOpen3DViewerForTarget}
              onOpenUploadModal={() => setIsUploadModalOpen(true)}
              stagedFiles={stagedFiles}
              onRemoveStagedFile={(id) => setStagedFiles(stagedFiles.filter(f => f.id !== id))}
              onExecuteAction={handleExecuteAction}
              onStartNewAnalysis={handleStartNewAnalysis}
              voiceSettings={voiceSettings}
              onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            />
          )}

          {currentMode === 'advanced' && (
            <AdvancedReasoningMode
              currentRun={currentRun}
              isRunning={isAgentRunning}
              onRunQuery={handleRunAgentInquiry}
              tools={tools}
              onSelectProtein={(sym) => {
                const p = proteins.find(item => item.geneSymbol === sym);
                if (p) setSelectedProtein(p);
              }}
            />
          )}

          {currentMode === 'discovery' && (
            <DiscoveryMode
              proteins={proteins}
              syngoTree={syngoTree}
              onSelectProtein={handleSelectProtein}
              onLaunchCoScientistForPathway={(q) => {
                handleRunAgentInquiry(q);
                setCurrentMode('advanced');
              }}
            />
          )}

          {currentMode === 'drug_discovery' && (
            <DrugDiscoveryMode
              onOpen3DViewerForTarget={(sym) => {
                setTargetProteinSymbol(sym);
                setCurrentMode('workspace');
              }}
              onSendToChat={(q) => {
                handleSendMessage(q);
                setCurrentMode('basic');
              }}
            />
          )}

          {currentMode === 'workspace' && (
            <WorkspaceMode
              currentRun={currentRun}
              isRunning={isAgentRunning}
              onRunQuery={handleRunAgentInquiry}
              proteins={proteins}
              onSelectProtein={handleSelectProtein}
              targetProteinSymbol={targetProteinSymbol}
            />
          )}
        </main>

        {/* Bottom Legal Attribution Footer */}
        <LegalFooter onOpenDisclaimer={() => setIsLegalModalOpen(true)} />
      </div>

      {/* 3. Multi-Omics File Upload Modal */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        uploadedFiles={uploadedFiles}
        onAddFiles={(files) => {
          setUploadedFiles(prev => [...prev, ...files]);
          setStagedFiles(prev => [...prev, ...files]);
        }}
        onDeleteFile={(id) => {
          setUploadedFiles(prev => prev.filter(f => f.id !== id));
          setStagedFiles(prev => prev.filter(f => f.id !== id));
        }}
        onLaunchAnalysisWithDataset={handleLaunchDatasetPipeline}
      />

      {/* 4. Full Legal Disclaimer Modal */}
      <LegalDisclaimerModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
      />

      {/* 5. Deep Synaptic Protein Inspector Modal */}
      <ProteinModal
        protein={selectedProtein}
        onClose={() => setSelectedProtein(null)}
        onQueryWithProtein={(query) => {
          setSelectedProtein(null);
          handleSendMessage(query);
          setCurrentMode('basic');
        }}
      />

      {/* 6. Comprehensive 15-Taxonomy Bioinformatics Analysis Hub Modal */}
      <ComprehensiveAnalysisHubModal
        isOpen={isNewAnalysisModalOpen}
        onClose={() => {
          setIsNewAnalysisModalOpen(false);
          setCatalogInitialAnalysisId(undefined);
        }}
        onLaunchAnalysis={handleLaunchCatalogAnalysis}
        initialAnalysisId={catalogInitialAnalysisId}
      />

      {/* 7. Voice Listening & Speech Synthesis Interaction Modal */}
      <VoiceInteractionModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        voiceSettings={voiceSettings}
        onUpdateVoiceSettings={setVoiceSettings}
        onVoiceTranscriptReceived={(transcript) => {
          handleSendMessage(transcript);
        }}
      />

      {/* 8. Multi-Format Scientific Report Download Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentRun={currentRun}
        sessionTitle={activeSession?.title}
      />
    </div>
  );
}
