import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Send, 
  Paperclip, 
  Sparkles, 
  Copy, 
  Check, 
  Dna, 
  Terminal, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Sliders, 
  Layers, 
  Bot, 
  User, 
  FileCode, 
  RotateCcw,
  Zap, 
  BarChart3, 
  FlaskConical, 
  Activity, 
  Play, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Square, 
  FolderOpen, 
  FileSpreadsheet, 
  FileText, 
  UploadCloud, 
  FileUp, 
  PlusCircle, 
  HelpCircle,
  FolderPlus,
  Info,
  X,
  File,
  Search,
  BookOpen
} from 'lucide-react';
import { ChatMessage, UploadedBioFile, ChatActionItem } from '../types';
import { 
  VoiceSettings, 
  speakText, 
  stopSpeaking, 
  startListening, 
  stopListening,
  subscribeToSpeechState,
  subscribeToListeningState
} from '../lib/voice-service';
import { AnalysisOutcomesExplorer } from './AnalysisOutcomesExplorer';

interface BasicChatModeProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, attachedFiles?: UploadedBioFile[]) => void;
  isRunning: boolean;
  onOpen3DViewerForTarget?: (geneSymbol: string) => void;
  onOpenUploadModal: () => void;
  stagedFiles: UploadedBioFile[];
  onRemoveStagedFile: (id: string) => void;
  onExecuteAction?: (action: ChatActionItem) => void;
  onStartNewAnalysis?: (analysisType: string) => void;
  voiceSettings?: VoiceSettings;
  onOpenVoiceModal?: () => void;
}

export const BasicChatMode: React.FC<BasicChatModeProps> = ({
  messages,
  onSendMessage,
  isRunning,
  onOpen3DViewerForTarget,
  onOpenUploadModal,
  stagedFiles,
  onRemoveStagedFile,
  onExecuteAction,
  onStartNewAnalysis,
  voiceSettings,
  onOpenVoiceModal
}) => {
  const [input, setInput] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Project Details State (clean, optional accordion/fields)
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectOrganism, setProjectOrganism] = useState('Homo sapiens (GRCh38)');
  const [projectBioDomain, setProjectBioDomain] = useState('Transcriptomics (RNA-Seq)');
  const [experimentalConditions, setExperimentalConditions] = useState('');
  const [projectHypothesis, setProjectHypothesis] = useState('');

  // Drag & drop state for direct file upload in chat box
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded message outcome view state (msgId -> 'chat' | 'folders' | 'report')
  const [expandedOutcomeView, setExpandedOutcomeView] = useState<Record<string, 'chat' | 'folders' | 'report'>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRunning]);

  useEffect(() => {
    const unsubSpeech = subscribeToSpeechState((speaking) => {
      if (!speaking) setActiveSpeakingMsgId(null);
    });
    const unsubListen = subscribeToListeningState((listening) => {
      setIsListening(listening);
    });
    return () => {
      unsubSpeech();
      unsubListen();
      stopSpeaking();
      stopListening();
    };
  }, []);

  const toggleMicListening = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      setMicError(null);
      const success = startListening(
        (transcript, isFinal) => {
          setInput((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript}` : transcript;
          });
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
          }
        },
        (err) => {
          setMicError(err);
          setIsListening(false);
        },
        voiceSettings?.listeningLanguage || 'en-US'
      );
      if (!success) {
        setIsListening(false);
      }
    }
  };

  const handleSpeakMessage = (msgId: string, content: string) => {
    if (activeSpeakingMsgId === msgId) {
      stopSpeaking();
      setActiveSpeakingMsgId(null);
    } else {
      setActiveSpeakingMsgId(msgId);
      speakText(content, voiceSettings).catch(() => {
        setActiveSpeakingMsgId(null);
      });
    }
  };

  // Direct local file staging via drag-and-drop or file picker
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Open the comprehensive upload modal to stage with full metadata and preview
    onOpenUploadModal();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanInput = input.trim();
    if (!cleanInput && stagedFiles.length === 0 && !projectTitle.trim()) return;
    if (isRunning) return;

    if (isListening) {
      stopListening();
      setIsListening(false);
    }

    // Compose rich query if project details are specified
    let finalPrompt = cleanInput;
    const hasProjectDetails = projectTitle.trim() || experimentalConditions.trim() || projectHypothesis.trim();

    if (hasProjectDetails) {
      const detailsBlocks = [
        projectTitle.trim() ? `**Project:** ${projectTitle.trim()}` : '',
        `**Organism:** ${projectOrganism}`,
        `**Biological Domain:** ${projectBioDomain}`,
        experimentalConditions.trim() ? `**Experimental Comparison:** ${experimentalConditions.trim()}` : '',
        projectHypothesis.trim() ? `**Hypothesis/Notes:** ${projectHypothesis.trim()}` : ''
      ].filter(Boolean).join(' | ');

      finalPrompt = `[Project Context: ${detailsBlocks}]\n\n${cleanInput || 'Execute comprehensive bioinformatics analysis on the specified experimental design and multi-omics data.'}`;
    }

    onSendMessage(finalPrompt || 'Perform comprehensive bioinformatics analysis', stagedFiles.length > 0 ? stagedFiles : undefined);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Curated benchmark datasets for quick 1-click loading
  const benchmarkDatasets = [
    { id: 'rnaseq_tumor_wt_counts', name: 'Tumor vs. Normal RNA-Seq (N=24)', type: 'CSV Matrix', size: '4.2 MB' },
    { id: 'sc_pbmc_10k_h5ad', name: 'PBMC 10k Single-Cell Atlas', type: 'H5AD AnnData', size: '18.4 MB' },
    { id: 'exome_pathogenic_vcf', name: 'Exome Sequencing Trio VCF', type: 'VCF Genomic', size: '2.1 MB' },
    { id: 'alphafold_kinase_pdb', name: 'Kinase AlphaFold3 Complex', type: 'PDB Model', size: '850 KB' }
  ];

  return (
    <div className="h-full flex flex-col justify-between bg-[#FAF9F5] dark:bg-[#0B0F17] overflow-hidden font-sans">
      {/* Clean, Non-Cluttered Top Bar */}
      <div className="bg-white/80 dark:bg-[#111722]/80 backdrop-blur-xs border-b border-[#E2DDD2] dark:border-[#1E293B] px-4 py-2.5 shrink-0">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              SynOmics Co-Scientist
            </span>
            <span className="text-[10px] text-[#64748B] dark:text-slate-400 hidden sm:inline">
              • AI-Powered Multi-Omics Research Engine
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct access to New Scientific Analysis Catalog */}
            <button
              onClick={() => onStartNewAnalysis?.('catalog')}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Open the Scientific Analysis Catalog with 15 Core Taxonomies"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>New Scientific Analysis Catalog</span>
            </button>

            {/* Quick Upload Action */}
            <button
              onClick={onOpenUploadModal}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#1A2234] border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 text-xs font-semibold text-[#334155] dark:text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Upload your multi-omics files (CSV, VCF, FASTQ, H5AD, PDB)"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Upload Data</span>
              {stagedFiles.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-mono font-bold">
                  {stagedFiles.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6 max-w-5xl w-full mx-auto">
        {messages.length === 0 ? (
          /* =========================================================================
             CLEAN, MINIMALIST EMPTY CHAT BOX (LIKE CHATGPT / CLAUDE)
             ========================================================================= */
          <div className="min-h-[75vh] flex flex-col items-center justify-center animate-fade-in-up py-6 max-w-3xl mx-auto w-full">
            
            {/* Minimal Centered Branding Header */}
            <div className="text-center space-y-2.5 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md">
                <Dna className="w-7 h-7" />
              </div>
              <h1 className="font-serif-brand text-3xl sm:text-4xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                SynOmics Co-Scientist
              </h1>
              <p className="text-sm text-[#64748B] dark:text-slate-400 max-w-md mx-auto">
                What bioinformatics inquiry or multi-omics analysis would you like to run today?
              </p>
            </div>

            {/* Central Clean Chat Input Box */}
            <div className="w-full bg-white dark:bg-[#131A29] rounded-3xl border border-[#DDD5C5] dark:border-[#1E293B] shadow-lg p-4 sm:p-5 space-y-3 transition-all focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/10">
              
              {/* Staged files badges if any */}
              {stagedFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#E2DDD2]/60 dark:border-slate-800">
                  {stagedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs font-mono text-emerald-900 dark:text-emerald-300"
                    >
                      <Paperclip className="w-3 h-3 text-emerald-600" />
                      <span className="font-medium truncate max-w-[150px]">{file.name}</span>
                      <span className="text-[10px] opacity-70">({file.size})</span>
                      <button
                        onClick={() => onRemoveStagedFile(file.id)}
                        className="hover:text-rose-600 ml-1 font-bold cursor-pointer"
                        title="Remove file"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything or describe your experiment (e.g. 'Run DESeq2 differential expression on tumor RNA-seq', 'Cluster single-cell data with Scanpy', 'Dock Gefitinib to EGFR')..."
                rows={3}
                className="w-full p-2 text-sm sm:text-base bg-transparent text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none resize-none leading-relaxed"
                autoFocus
              />

              {/* Bottom Toolbar inside Chat Card */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#F0EBE0] dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* File Upload Button */}
                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                    title="Attach Multi-Omics Files (CSV, TSV, VCF, FASTQ, H5AD, PDB)"
                  >
                    <Paperclip className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Attach Data</span>
                  </button>

                  {/* Catalog Button */}
                  <button
                    type="button"
                    onClick={() => onStartNewAnalysis?.('catalog')}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Open the Scientific Analysis Catalog (15 Pipelines)"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Scientific Catalog</span>
                  </button>

                  {/* Voice Dictation */}
                  <button
                    type="button"
                    onClick={toggleMicListening}
                    className={`p-2 rounded-xl transition-all text-xs flex items-center gap-1.5 cursor-pointer ${
                      isListening
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse font-semibold'
                        : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800'
                    }`}
                    title={isListening ? 'Stop Listening' : 'Dictate with Microphone'}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4 text-rose-600 animate-bounce" />
                        <span className="text-rose-600 dark:text-rose-300 text-xs font-mono">Listening...</span>
                      </>
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>

                  {/* Optional Project Context Toggle */}
                  <button
                    type="button"
                    onClick={() => setShowProjectDetails(!showProjectDetails)}
                    className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                    title="Configure Organism, Genome, or Study Name"
                  >
                    <FolderPlus className="w-4 h-4 text-indigo-500" />
                    <span className="hidden md:inline">Project Details</span>
                  </button>
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={isRunning || (!input.trim() && stagedFiles.length === 0)}
                  className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md transition-all cursor-pointer shrink-0"
                  title="Send analysis inquiry"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Optional Project Details Drawer (Only shown if user explicitly clicked) */}
              {showProjectDetails && (
                <div className="mt-3 p-3.5 border-t border-[#E2DDD2] dark:border-slate-800 space-y-3 bg-[#FAF9F5] dark:bg-[#0E131E] rounded-2xl animate-fade-in-up">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">
                        Project / Study Title
                      </label>
                      <input
                        type="text"
                        value={projectTitle}
                        onChange={(e) => setProjectTitle(e.target.value)}
                        placeholder="e.g. PDAC KRAS Resistance Study"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#DDD5C5] dark:border-slate-700 bg-white dark:bg-[#131A29] text-xs text-[#0F172A] dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#475569] dark:text-slate-300">
                        Organism &amp; Genome Build
                      </label>
                      <select
                        value={projectOrganism}
                        onChange={(e) => setProjectOrganism(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#DDD5C5] dark:border-slate-700 bg-white dark:bg-[#131A29] text-xs text-[#0F172A] dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                      >
                        <option value="Homo sapiens (GRCh38)">Homo sapiens (GRCh38.p13)</option>
                        <option value="Mus musculus (GRCm39)">Mus musculus (GRCm39 / mm39)</option>
                        <option value="Rattus norvegicus (mRatBN7)">Rattus norvegicus (mRatBN7)</option>
                        <option value="Drosophila melanogaster (dm6)">Drosophila melanogaster (dm6)</option>
                        <option value="Danio rerio (GRCz11)">Danio rerio (GRCz11)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Starter Suggestion Chips */}
            <div className="w-full mt-6 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    setInput("Perform DESeq2 differential gene expression analysis on our RNA-Seq count matrix. Filter low counts, apply variance stabilizing transformation, generate Volcano plot and PCA clustering, and identify top enriched KEGG / Reactome pathways.");
                  }}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-between">
                    <span>📊 RNA-Seq Differential Expression &amp; Volcano</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-1 mt-0.5">
                    DESeq2 GLM modeling, volcano plot, and pathway enrichment
                  </p>
                </button>

                <button
                  onClick={() => {
                    setInput("Analyze single-cell RNA-seq AnnData matrix with Scanpy. Filter low-quality droplets (<200 genes, >10% mito), perform Leiden clustering, compute UMAP 2D embedding, and identify cell-type specific marker genes.");
                  }}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-between">
                    <span>🧬 Single-Cell Scanpy &amp; UMAP Clustering</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-1 mt-0.5">
                    Quality filtering, Leiden community detection, and marker genes
                  </p>
                </button>

                <button
                  onClick={() => {
                    setInput("Annotate genomic variant VCF file. Filter for high-impact missense and loss-of-function variants, score with CADD and ClinVar pathogenicity databases, and evaluate disease risk loci.");
                  }}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-between">
                    <span>🎯 Genomic Variant Prioritization &amp; CADD</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-1 mt-0.5">
                    VCF filtering, pathogenicity scoring, and clinical associations
                  </p>
                </button>

                <button
                  onClick={() => {
                    setInput("Perform AlphaFold 3 structural modeling and molecular docking of Gefitinib against EGFR tyrosine kinase (PDB 1M17). Calculate thermodynamic binding affinity (ΔG in kcal/mol), estimated Ki (nM), and comprehensive ADMET profile.");
                  }}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] hover:border-emerald-600 dark:hover:border-emerald-500 hover:shadow-xs transition-all text-left cursor-pointer group"
                >
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center justify-between">
                    <span>🔬 AlphaFold 3 &amp; Molecular Docking (ΔG)</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-1 mt-0.5">
                    Pocket druggability, AutoDock Vina binding energy, and ADMET
                  </p>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             MESSAGES STREAM (Clean, Formatted & Interactive)
             ========================================================================= */
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const currentView = expandedOutcomeView[msg.id] || 'chat';

            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 animate-fade-in-up ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant Icon */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                {/* Bubble Container */}
                <div
                  className={`max-w-4xl w-full ${
                    isUser
                      ? 'bg-[#E7E0D2] dark:bg-[#1E293B] text-[#1D1C16] dark:text-[#F8FAFC] rounded-2xl rounded-tr-xs p-4 shadow-xs self-end'
                      : 'bg-white dark:bg-[#131A29] text-[#0F172A] dark:text-[#F8FAFC] rounded-2xl p-5 border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs'
                  }`}
                >
                  {/* Attached Files Meta */}
                  {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {msg.attachedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-[#D5CDBC] dark:border-slate-700 text-xs font-mono text-[#0F172A] dark:text-slate-200"
                        >
                          <Paperclip className="w-3 h-3 text-emerald-600" />
                          <span>{file.name}</span>
                          <span className="text-[10px] text-[#64748B]">({file.type})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* VIEW 1: Standard Chat Markdown */}
                  {(isUser || currentView === 'chat') && (
                    <div className="space-y-3">
                      <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed font-sans
                                      prose-headings:font-semibold prose-headings:text-[#0F172A] dark:prose-headings:text-slate-100
                                      prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h4:text-xs
                                      prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                                      prose-code:bg-slate-100 dark:prose-code:bg-slate-800/80 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono
                                      prose-pre:bg-[#181E2B] prose-pre:text-slate-100 prose-pre:p-3 prose-pre:rounded-xl prose-pre:border prose-pre:border-slate-800
                                      prose-table:text-xs prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:p-2 prose-td:p-2 prose-td:border-b prose-td:border-slate-200 dark:prose-td:border-slate-800
                                      prose-a:text-emerald-700 dark:prose-a:text-emerald-400 prose-a:underline hover:prose-a:text-emerald-600">
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        )}
                      </div>

                      {/* Code Snippet Card if present */}
                      {msg.codeSnippet && (
                        <div className="mt-4 rounded-xl overflow-hidden border border-[#D5CDBC] dark:border-slate-700 bg-[#181E2B] text-slate-100 font-mono text-xs shadow-xs">
                          <div className="flex items-center justify-between px-3.5 py-2 bg-[#121620] border-b border-slate-700/80 text-[11px] text-slate-400">
                            <div className="flex items-center gap-2">
                              <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{msg.codeSnippet.filename || `${msg.codeSnippet.language} script`}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopy(msg.codeSnippet!.code, msg.id)}
                                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                              >
                                {copiedCodeId === msg.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy code</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <pre className="p-3.5 overflow-x-auto text-xs leading-relaxed text-emerald-300">
                            <code>{msg.codeSnippet.code}</code>
                          </pre>
                        </div>
                      )}

                      {/* Artifacts Row */}
                      {msg.agentRun && (
                        <div className="mt-3 pt-2.5 border-t border-[#E2DDD2]/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Figures, data tables &amp; scripts generated</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setExpandedOutcomeView(prev => ({
                                ...prev,
                                [msg.id]: 'folders'
                              }))}
                              className="px-2.5 py-1 rounded-lg bg-[#F4EFE6] dark:bg-slate-800 border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 text-xs font-medium text-[#0F172A] dark:text-slate-200 transition-colors cursor-pointer"
                            >
                              View Artifacts &amp; Figures
                            </button>
                            <button
                              onClick={() => setExpandedOutcomeView(prev => ({
                                ...prev,
                                [msg.id]: 'report'
                              }))}
                              className="px-2.5 py-1 rounded-lg bg-[#F4EFE6] dark:bg-slate-800 border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 text-xs font-medium text-[#0F172A] dark:text-slate-200 transition-colors cursor-pointer"
                            >
                              Full Report
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIEW 2: Folders Explorer (Figures 1-by-1, Tables, Code) */}
                  {!isUser && currentView === 'folders' && (
                    <div className="pt-2 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#E2DDD2] dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Generated Artifacts &amp; Visuals</span>
                        </span>
                        <button
                          onClick={() => setExpandedOutcomeView(prev => ({ ...prev, [msg.id]: 'chat' }))}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
                        >
                          ← Back to Chat
                        </button>
                      </div>
                      <AnalysisOutcomesExplorer
                        agentRun={msg.agentRun}
                        codeSnippet={msg.codeSnippet}
                        queryTitle={msg.content.slice(0, 80).replace(/[#*]/g, '').trim()}
                        defaultFolder="figures"
                        onOpen3DViewer={onOpen3DViewerForTarget}
                      />
                    </div>
                  )}

                  {/* VIEW 3: General Scientific Report */}
                  {!isUser && currentView === 'report' && (
                    <div className="pt-2 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-[#E2DDD2] dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Scientific Publication Report</span>
                        </span>
                        <button
                          onClick={() => setExpandedOutcomeView(prev => ({ ...prev, [msg.id]: 'chat' }))}
                          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
                        >
                          ← Back to Chat
                        </button>
                      </div>
                      <AnalysisOutcomesExplorer
                        agentRun={msg.agentRun}
                        codeSnippet={msg.codeSnippet}
                        queryTitle={msg.content.slice(0, 80).replace(/[#*]/g, '').trim()}
                        defaultFolder="report"
                        onOpen3DViewer={onOpen3DViewerForTarget}
                      />
                    </div>
                  )}

                  {/* Suggested next steps */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-[#E2DDD2] dark:border-slate-800 space-y-1.5">
                      <div className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        <span>Suggested next steps</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedActions.map((action) => (
                          <button
                            key={action.id}
                            onClick={() => onExecuteAction && onExecuteAction(action)}
                            className="px-2.5 py-1 rounded-lg bg-[#F4EFE6] dark:bg-slate-800/80 border border-[#DDD5C5] dark:border-slate-700 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs text-[#0F172A] dark:text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <span>{action.label}</span>
                            <ChevronRight className="w-3 h-3 text-[#94A3B8]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3D Structure / Pipeline Action Badges — ONLY if show3DViewer is true */}
                  {msg.show3DViewer && msg.molecularTarget && onOpen3DViewerForTarget && (
                    <div className="mt-3.5 pt-3 border-t border-[#E2DDD2] dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-[#64748B] dark:text-slate-400">
                        Target Molecular Complex: <strong className="text-[#0F172A] dark:text-slate-200">{msg.molecularTarget}</strong>
                      </span>
                      <button
                        onClick={() => onOpen3DViewerForTarget(msg.molecularTarget!)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Inspect in 3D Viewer</span>
                      </button>
                    </div>
                  )}

                  {/* Message Bottom Action Bar */}
                  <div className="mt-3 pt-2 border-t border-[#E2DDD2]/60 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                    {!isUser ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSpeakMessage(msg.id, msg.content)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                            activeSpeakingMsgId === msg.id
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-semibold animate-pulse'
                              : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800'
                          }`}
                          title={activeSpeakingMsgId === msg.id ? 'Stop Speech' : 'Listen to Response (Neural Voice)'}
                        >
                          {activeSpeakingMsgId === msg.id ? (
                            <>
                              <Square className="w-3 h-3 text-amber-600 fill-current" />
                              <span>Stop Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3 text-emerald-600" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Copy Full Message"
                        >
                          {copiedCodeId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copy</span>
                        </button>
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="text-[10px] text-[#94A3B8] font-mono">
                      {msg.timestamp}
                    </div>
                  </div>
                </div>

                {/* User Icon */}
                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[#D5CDBC] dark:bg-slate-700 text-[#1D1C16] dark:text-slate-200 flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Live Loading Pulse */}
        {isRunning && (
          <div className="flex gap-3.5 items-start animate-fade-in-up">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131A29] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xs flex items-center gap-3">
              <div className="flex space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-[#059669] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#059669] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-[#059669] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-[#64748B] dark:text-slate-400 font-medium">
                SynOmics co-scientist reasoning across universal multi-omics bioinformatics databases...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Clean Bottom Input Bar (When Messages Exist) */}
      {messages.length > 0 && (
        <div className="p-4 bg-[#FAF9F5] dark:bg-[#0B0F17] border-t border-[#E2DDD2] dark:border-[#1E293B] shrink-0">
          <div className="max-w-5xl mx-auto space-y-2">
            {/* Staged files chips */}
            {stagedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {stagedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300 font-mono shadow-2xs"
                  >
                    <Dna className="w-3 h-3 text-emerald-600" />
                    <span className="truncate max-w-[140px]">{file.name}</span>
                    <button
                      onClick={() => onRemoveStagedFile(file.id)}
                      className="hover:text-rose-600 ml-1 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Box Card */}
            <div className="relative rounded-2xl bg-white dark:bg-[#131A29] border border-[#D5CDBC] dark:border-[#1E293B] shadow-xs focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask follow-up questions, request new plots, or provide additional instructions..."
                rows={1}
                className="w-full px-4 pt-3 pb-11 text-sm bg-transparent text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none resize-none leading-relaxed"
              />

              {/* Bottom Controls Bar inside Input */}
              <div className="absolute left-3 right-3 bottom-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onOpenUploadModal}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                    title="Attach Multi-Omics Data Files (CSV, VCF, FASTQ, H5AD, PDB)"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="hidden sm:inline">Upload Bio-Data</span>
                  </button>

                  {/* Direct Catalog Shortcut */}
                  <button
                    type="button"
                    onClick={() => onStartNewAnalysis?.('catalog')}
                    className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                    title="Open New Scientific Analysis Catalog"
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="hidden md:inline">Catalog</span>
                  </button>

                  {/* Voice Listening Toggle */}
                  <button
                    type="button"
                    onClick={toggleMicListening}
                    className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1.5 cursor-pointer ${
                      isListening
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse font-semibold'
                        : 'text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800'
                    }`}
                    title={isListening ? 'Stop Listening' : 'Dictate with Microphone'}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-4 h-4 text-rose-600 animate-bounce" />
                        <span className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">Listening...</span>
                      </>
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>

                  {/* Voice Configuration Trigger */}
                  {onOpenVoiceModal && (
                    <button
                      type="button"
                      onClick={onOpenVoiceModal}
                      className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#F3EFE6] dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                      title="Voice Engine Settings"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#94A3B8] hidden sm:inline font-mono">
                    Press ↵ to send
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={isRunning || (!input.trim() && stagedFiles.length === 0)}
                    className="w-8 h-8 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Microphone error toast if any */}
            {micError && (
              <div className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <span>⚠️ {micError}</span>
                <button onClick={() => setMicError(null)} className="font-bold ml-2 cursor-pointer">×</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


