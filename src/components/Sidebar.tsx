import React, { useState } from 'react';
import { 
  Plus, 
  Upload, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  Archive, 
  Copy, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Dna, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight,
  FolderOpen,
  Sparkles
} from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession?: () => void;
  onNewAnalysis: () => void;
  onOpenUploadModal: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onDuplicateSession: (id: string) => void;
  onArchiveSession: (id: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLegalModal: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onNewAnalysis,
  onOpenUploadModal,
  onRenameSession,
  onDeleteSession,
  onDuplicateSession,
  onArchiveSession,
  isDarkMode,
  onToggleDarkMode,
  onOpenLegalModal,
  isCollapsed,
  onToggleCollapse
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredSessions = sessions.filter(s => 
    !s.isArchived && 
    (s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
     (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  if (isCollapsed) {
    return (
      <aside className="w-14 shrink-0 h-screen border-r border-[#E2DDD2] dark:border-[#1E293B] bg-[#F3EFE6] dark:bg-[#0E131E] flex flex-col items-center py-3.5 justify-between transition-all select-none z-30">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onToggleCollapse}
            title="Expand Sidebar"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-[#E2DDD2] dark:border-slate-700 hover:bg-[#E8E1D2] text-[#0F172A] dark:text-slate-200 transition-colors shadow-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={onNewSession || onNewAnalysis}
            title="New Chat Session"
            className="w-9 h-9 rounded-xl bg-[#059669] hover:bg-[#047857] text-white flex items-center justify-center shadow-xs transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          <button
            onClick={onNewAnalysis}
            title="New Specialized Analysis"
            className="w-9 h-9 rounded-xl bg-[#E8E1D2] dark:bg-slate-800 border border-[#D5CDBC] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 flex items-center justify-center hover:bg-[#DDD5C5] transition-colors shadow-xs"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            onClick={onOpenUploadModal}
            title="Upload Multi-Omics Files"
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-[#E2DDD2] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 flex items-center justify-center hover:bg-[#E8E1D2] transition-colors shadow-xs"
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            className="p-2 rounded-lg text-[#64748B] hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#E8E1D2] dark:hover:bg-slate-800 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" title="SynOmics Engine Online" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 sm:w-72 shrink-0 h-screen border-r border-[#E2DDD2] dark:border-[#1E293B] bg-[#F3EFE6] dark:bg-[#0E131E] flex flex-col justify-between transition-all select-none z-30 font-sans">
      {/* Top Header & Actions */}
      <div className="p-4 space-y-3">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Dna className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif-brand font-bold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                  SynOmics
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800">
                  v7.0
                </span>
              </div>
              <span className="text-[10px] text-[#64748B] dark:text-slate-400 block -mt-0.5 font-medium">
                Universal Multi-Omics Platform
              </span>
            </div>
          </div>

          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-[#E8E1D2] dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Action Button: + New Analysis / New Chat */}
        <div className="space-y-1.5">
          <button
            onClick={onNewAnalysis}
            className="w-full py-2.5 px-3 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            title="Start a new, empty chat like ChatGPT or Claude"
          >
            <Plus className="w-4 h-4 text-white stroke-[2.5]" />
            <span>+ New Analysis</span>
          </button>
        </div>

        {/* Secondary Upload Action */}
        <button
          onClick={onOpenUploadModal}
          className="w-full py-1.5 px-3 rounded-xl bg-white/70 hover:bg-white dark:bg-[#12161F]/70 dark:hover:bg-[#12161F] text-[#334155] dark:text-slate-300 border border-[#E2DDD2] dark:border-[#1E293B] text-xs font-medium transition-colors flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Browse &amp; Upload Files</span>
          </div>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800">
            Any Format
          </span>
        </button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search sessions or pipelines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-[#E2DDD2] dark:border-[#1E293B] text-xs text-[#0F172A] dark:text-slate-200 placeholder:text-[#94A3B8] focus:outline-none focus:border-emerald-600 transition-colors"
          />
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1 py-1">
        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
          <span>Recent Sessions</span>
          <span className="text-[10px] font-mono bg-[#E8E1D2] dark:bg-slate-800 px-1.5 py-0.2 rounded text-[#475569] dark:text-slate-300">
            {filteredSessions.length}
          </span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#94A3B8]">
            No matching sessions found.
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative w-full p-2 rounded-xl text-left transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#E3DCC9] dark:bg-[#1E293B] border-[#D5CDBC] dark:border-slate-600 shadow-xs'
                    : 'border-transparent hover:bg-[#E8E1D2]/70 dark:hover:bg-slate-800/60 text-[#334155] dark:text-slate-300'
                }`}
              >
                {isEditing ? (
                  <form onSubmit={(e) => handleSaveRename(session.id, e)} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      onBlur={() => setEditingId(null)}
                      className="w-full text-xs px-2 py-1 rounded bg-white dark:bg-slate-900 border border-emerald-500 focus:outline-none text-[#0F172A] dark:text-slate-100"
                    />
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/80 dark:bg-slate-900/80 text-[#475569] dark:text-slate-300 border border-[#D5CDBC]/60 dark:border-slate-700 font-semibold">
                          {session.category}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          {session.messages.length} msg
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] truncate">
                        {session.title}
                      </p>
                    </div>

                    {/* Context menu trigger */}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === session.id ? null : session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-[#64748B] transition-opacity"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {/* Context Dropdown Menu */}
                      {menuOpenId === session.id && (
                        <div
                          className="absolute right-0 top-6 z-50 w-36 rounded-xl bg-white dark:bg-[#161D2B] border border-[#E2DDD2] dark:border-[#1E293B] shadow-xl py-1 text-xs text-[#334155] dark:text-slate-200 animate-fade-in-up"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => handleStartRename(session, e)}
                            className="w-full px-3 py-1.5 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 flex items-center gap-2 text-left"
                          >
                            <Edit3 className="w-3 h-3 text-[#64748B]" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicateSession(session.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 flex items-center gap-2 text-left"
                          >
                            <Copy className="w-3 h-3 text-[#64748B]" />
                            <span>Duplicate</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onArchiveSession(session.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-[#FAF9F5] dark:hover:bg-slate-800 flex items-center gap-2 text-left"
                          >
                            <Archive className="w-3 h-3 text-[#64748B]" />
                            <span>Archive</span>
                          </button>
                          <div className="my-1 border-t border-[#E2DDD2] dark:border-slate-800" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 text-left"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-[#E2DDD2] dark:border-[#1E293B] space-y-2 bg-[#F3EFE6] dark:bg-[#0E131E]">
        {/* Live Engine Status */}
        <div className="flex items-center justify-between px-2 py-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-medium text-[#475569] dark:text-slate-300">
              SynOmics Active
            </span>
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Warm Linen Light' : 'Switch to Deep Obsidian Dark'}
            className="p-1.5 rounded-lg bg-white/70 dark:bg-slate-800 border border-[#E2DDD2] dark:border-slate-700 text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] transition-colors"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Legal & Attribution trigger */}
        <button
          onClick={onOpenLegalModal}
          className="w-full py-1 px-2 rounded-lg text-[11px] text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#E8E1D2]/50 dark:hover:bg-slate-800/60 flex items-center justify-center gap-1.5 transition-colors"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Legal • SynOmics Platform 2026</span>
        </button>
      </div>
    </aside>
  );
};
