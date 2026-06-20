'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Brain, Plus, Search, MessageSquare, Network, Tag, Zap,
  Loader2, ArrowLeft, Pin, PinOff, Trash2, ChevronRight,
  Sparkles, AlertCircle, BookOpen, TrendingUp, RefreshCw,
  Copy, Check, X, Info, Moon, Sun, Download, Paperclip, LogOut, User
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';

const ForceGraph = dynamic(() => import('@/components/ForceGraph'), { ssr: false });
// ── Types ─────────────────────────────────────────────────────────────
interface Note {
  id: string;
  title: string;
  content: string;
  formatted_content?: string;
  tags: string[];
  summary: string;
  key_concepts: string[];
  connection_count: number;
  is_pinned: boolean;
  created_at: string;
  view_count: number;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  formatted_content?: string;
  tags: string[];
  summary: string;
  similarity: number;
}

interface GraphNode { id: string; title: string; tags: string[]; degree: number; }
interface GraphEdge { from_note_id: string; to_note_id: string; similarity_score: number; connection_reason: string; }
interface Stats { note_count: number; connected_notes: number; avg_similarity: number; top_tag: string; }

// ── Helpers ───────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60)   return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function ThemeToggle({ iconOnly }: { iconOnly?: boolean }) {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
  }, []);

  return (
    <button 
      className={`btn-ghost text-xs justify-center flex items-center ${iconOnly ? 'p-2' : 'w-full gap-2'}`}
      onClick={() => {
        const html = document.documentElement;
        const newIsLight = html.getAttribute('data-theme') !== 'light';
        if (!newIsLight) {
          html.removeAttribute('data-theme');
          localStorage.setItem('theme', 'dark');
        } else {
          html.setAttribute('data-theme', 'light');
          localStorage.setItem('theme', 'light');
        }
        setIsLight(newIsLight);
      }}
    >
      {isLight ? <Moon size={iconOnly ? 16 : 12} /> : <Sun size={iconOnly ? 16 : 12} />} {!iconOnly && "Toggle Theme"}
    </button>
  );
}

function similarityColor(s: number): string {
  if (s > 0.7) return '#10B981';
  if (s > 0.5) return '#6366F1';
  if (s > 0.35) return '#F59E0B';
  return '#94A3B8';
}

// ── Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ activeTab, setActiveTab, noteCount, qaCount }: {
  activeTab: string; setActiveTab: (t: string) => void; noteCount: number; qaCount: number;
}) {
  const tabs = [
    { id: 'notes',       icon: BookOpen,       label: 'Notes',      badge: noteCount },
    { id: 'search',      icon: Search,         label: 'Search' },
    { id: 'ask',         icon: MessageSquare,  label: 'Ask AI',     badge: qaCount, color: '#8B5CF6' },
    { id: 'connections', icon: Network,        label: 'Connections' },
    { id: 'organize',    icon: RefreshCw,      label: 'Organize' },
    { id: 'account',     icon: User,           label: 'Account' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r h-full z-10 transition-colors"
        style={{ borderColor: 'var(--border)', background: 'rgba(15,23,42,0.5)' }}>
        <div className="h-14 flex items-center justify-between px-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
              <Brain size={14} color="white"/>
            </div>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Recall</span>
          </a>
          <Link href="/" className="p-1.5 rounded-lg hover:bg-slate-800/10 dark:hover:bg-slate-100/10 transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" title="Go to Homepage">
            <ArrowLeft size={16}/>
          </Link>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {tabs.map(({ id, icon: Icon, label, badge, color }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150"
                style={{
                  background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: active ? '#A5B4FC' : 'var(--text-secondary)',
                  border: active ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                }}>
                <Icon size={15} color={active ? color ?? '#6366F1' : undefined}/>
                <span className="flex-1 text-left">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', minWidth: 20, textAlign: 'center' }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t flex-shrink-0 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="btn-ghost w-full text-xs justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut size={12}/> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
            <Brain size={14} color="white"/>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Recall</span>
        </a>
        <div className="flex items-center gap-3">
          <ThemeToggle iconOnly={true} />
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-red-400 hover:text-red-300 transition-colors"
            title="Sign Out"
          >
            <LogOut size={16}/>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden !fixed bottom-0 left-0 right-0 h-16 border-t flex items-center justify-around !z-50 px-2 pb-safe"
           style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
        {tabs.map(({ id, icon: Icon, label, color }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex flex-col items-center justify-center w-full h-full gap-1 transition-all">
              <Icon size={20} color={active ? color ?? '#6366F1' : 'var(--text-muted)'} />
              <span className="text-[10px]" style={{ color: active ? '#A5B4FC' : 'var(--text-muted)' }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

// ── RenderContent Helper ──────────────────────────────────────────────
function RenderContent({ content, onLinkClick }: { content: string, onLinkClick: (t: string) => void }) {
  if (!content) return null;
  // Convert [[wikilink]] to markdown links so ReactMarkdown parses them
  const processedContent = content.replace(/\[\[(.*?)\]\]/g, '[$1](wiki://$1)');

  return (
    <div className="prose prose-sm max-w-none prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-p:leading-relaxed prose-strong:text-[var(--text-primary)] prose-strong:font-semibold prose-ul:text-[var(--text-secondary)] prose-li:text-[var(--text-secondary)] prose-a:text-[#8B5CF6] prose-hr:my-4 prose-p:my-2 prose-headings:my-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children, ...props }) => {
            if (href?.startsWith('wiki://')) {
              const title = decodeURIComponent(href.slice(7));
              return (
                <span onClick={() => onLinkClick(title)} 
                      className="cursor-pointer font-medium hover:underline transition-all"
                      style={{ color: '#8B5CF6' }}>
                  [[{title}]]
                </span>
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// ── Note Card ─────────────────────────────────────────────────────────
function NoteCard({ note, onPin, onDelete, onClick }: {
  note: Note; onPin: () => void; onDelete: () => void; onClick: () => void;
}) {
  return (
    <div className="glass glass-hover rounded-xl p-4 note-appear cursor-pointer transition-all duration-200"
      onClick={onClick}
      style={{ borderColor: note.is_pinned ? 'rgba(99,102,241,0.4)' : undefined }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm leading-snug flex-1"
          style={{ color: 'var(--text-primary)' }}>{note.title}</h3>
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={e => { e.stopPropagation(); onPin(); }}
            className="p-1 rounded hover:opacity-80 transition-opacity"
            title={note.is_pinned ? 'Unpin' : 'Pin'}
            style={{ color: note.is_pinned ? '#6366F1' : 'var(--text-muted)' }}>
            {note.is_pinned ? <Pin size={12}/> : <PinOff size={12}/>}
          </button>
          <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}>
            <Trash2 size={12}/>
          </button>
        </div>
      </div>

      {note.summary && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {note.summary}
        </p>
      )}

      <div className="flex flex-wrap gap-1 mb-3">
        {note.tags.slice(0, 4).map(tag => (
          <span key={tag} className="tag-pill" style={{ fontSize: 10 }}>#{tag}</span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{timeAgo(note.created_at)}</span>
        <div className="flex items-center gap-3">
          {note.connection_count > 0 && (
            <span className="flex items-center gap-1" style={{ color: '#06B6D4' }}>
              <Network size={10}/> {note.connection_count}
            </span>
          )}
          <span className="flex items-center gap-1">
            <BookOpen size={10}/> {note.view_count}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Notes ────────────────────────────────────────────────────────
function NotesTab({ notes, allTags, loading, onRefresh, noteIdToOpen, setNoteIdToOpen }: {
  notes: Note[]; allTags: string[]; loading: boolean; onRefresh: () => void;
  noteIdToOpen?: string | null; setNoteIdToOpen?: (id: string | null) => void;
}) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autoSplit, setAutoSplit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listWidth, setListWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [inputHeight, setInputHeight] = useState(250);
  const [toastError, setToastError] = useState<string | null>(null);

  const [showAddConnection, setShowAddConnection] = useState(false);
  const [connectionNoteId, setConnectionNoteId] = useState('');

  async function addManualConnection() {
    if (!connectionNoteId || !selectedNote) return;
    try {
      await fetch('/api/connections/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_note_id: selectedNote.id, to_note_id: connectionNoteId })
      });
      setShowAddConnection(false);
      setConnectionNoteId('');
      openNote(selectedNote);
    } catch (e) {
      console.error(e);
    }
  }

  async function removeManualConnection(e: React.MouseEvent, toId: string) {
    e.stopPropagation();
    if (!selectedNote) return;
    try {
      await fetch(`/api/connections/manual?from_note_id=${selectedNote.id}&to_note_id=${toId}`, {
        method: 'DELETE'
      });
      openNote(selectedNote);
    } catch (err) {
      console.error(err);
    }
  }

  function showError(msg: string) {
    setToastError(msg);
    setTimeout(() => setToastError(null), 4000);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract text');
      
      setContent(prev => (prev ? prev + '\n\n' : '') + data.text);
    } catch (err: any) {
      showError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  useEffect(() => {
    if (!isResizing) return;
    function handleMouseMove(e: MouseEvent) {
      // Assuming sidebar is 224px (w-56)
      const newWidth = e.clientX - 224;
      if (newWidth < 280) return setListWidth(280);
      if (newWidth > 800) return setListWidth(800);
      setListWidth(newWidth);
    }
    function handleMouseUp() {
      setIsResizing(false);
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const filteredNotes = activeTag
    ? notes.filter(n => n.tags.includes(activeTag))
    : notes;

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, autoSplit }),
      });
      if (!res.ok) throw new Error('Failed');
      setContent('');
      onRefresh();
    } catch (e: any) {
      showError('Failed to save note. ' + (e.message || 'Check your API keys.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function openNote(note: Note) {
    setSelectedNote(note);
    const res = await fetch(`/api/notes/${note.id}`);
    const data = await res.json();
    setConnections(data.connections ?? []);
  }

  useEffect(() => {
    if (noteIdToOpen && setNoteIdToOpen) {
      const note = notes.find(n => n.id === noteIdToOpen);
      if (note) {
        openNote(note);
      }
      setNoteIdToOpen(null);
    }
  }, [noteIdToOpen, notes, setNoteIdToOpen]);

  function openNoteByTitle(title: string) {
    const note = notes.find(n => n.title.toLowerCase() === title.toLowerCase());
    if (note) openNote(note);
    else showError(`Note "${title}" not found in your knowledge base.`);
  }

  async function togglePin(note: Note) {
    await fetch(`/api/notes/${note.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    onRefresh();
  }

  async function deleteNote(id: string) {
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (selectedNote?.id === id) setSelectedNote(null);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className={`flex flex-1 overflow-hidden relative ${isResizing ? 'select-none' : ''}`}>
      {/* Note list */}
      <div className={`w-full md:w-[var(--list-width)] flex-shrink-0 flex-col overflow-y-auto pb-20 md:pb-0 ${selectedNote ? 'hidden md:flex' : 'flex'}`}
        style={{ '--list-width': `${listWidth}px`, borderRight: '1px solid var(--border)' } as any}>
        
        {toastError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2 backdrop-blur-md">
              <AlertCircle size={16} />
              {toastError}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-b relative" style={{ borderColor: 'var(--border)' }}>
          <div className="p-4 pb-2 relative">
            <textarea ref={textRef} value={content} onChange={e => setContent(e.target.value)}
              className="input-base text-sm pb-10 resize-none"
              style={{ height: inputHeight }}
              placeholder="Paste a meeting note, idea, article, or anything...&#10;&#10;AI will auto-title, tag, and connect it."
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(); }}/>
            
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.txt,.md,.csv,.jpg,.jpeg,.png"/>
            <button 
              className="absolute bottom-4 left-6 btn-ghost p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5" 
              style={{ color: 'var(--text-muted)' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Upload file (PDF, Docx, TXT, Images...)"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
          </div>
          
          <div className="flex items-center gap-2 px-4 pb-3">
            <input type="checkbox" id="autoSplit" checked={autoSplit} onChange={e => setAutoSplit(e.target.checked)} className="rounded" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }} />
            <label htmlFor="autoSplit" className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-split large text</label>
          </div>
          <div className="px-4 pb-4">
            <button className="btn-primary w-full text-sm py-2" onClick={handleSubmit}
              disabled={submitting || !content.trim()}>
              {submitting ? <><Loader2 size={14} className="animate-spin"/> Analyzing...</> : <><Zap size={14}/> Save & Analyze</>}
            </button>
            <p className="text-center text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>⌘+Enter to save</p>
          </div>

          {/* Custom Bottom Resize Handle */}
          <div 
            className="absolute bottom-0 left-0 w-full h-4 flex items-center justify-center cursor-ns-resize group z-10"
            style={{ transform: 'translateY(50%)' }}
            onPointerDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = inputHeight;
              const move = (me: PointerEvent) => {
                const newH = startH + (me.clientY - startY);
                setInputHeight(Math.min(Math.max(100, newH), window.innerHeight * 0.8));
              };
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                document.body.style.cursor = '';
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
              document.body.style.cursor = 'ns-resize';
            }}
          >
            <div className="w-12 h-1.5 rounded-full bg-black/10 dark:bg-white/10 group-hover:bg-indigo-500/40 transition-colors"></div>
          </div>
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="px-3 py-2 flex gap-1.5 flex-wrap border-b" style={{ borderColor: 'var(--border)' }}>
            <button className={`tag-pill ${!activeTag ? 'active' : ''}`} onClick={() => setActiveTag(null)}>
              All
            </button>
            {allTags.slice(0, 8).map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`tag-pill ${activeTag === tag ? 'active' : ''}`}>
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Notes */}
        <div className="flex-1 overflow-visible p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin" style={{ color: '#6366F1' }}/>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-10">
              <Brain size={28} className="mx-auto mb-3 opacity-30"/>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add your first note above</p>
            </div>
          ) : filteredNotes.map(note => (
            <NoteCard key={note.id} note={note}
              onClick={() => openNote(note)}
              onPin={() => togglePin(note)}
              onDelete={() => deleteNote(note.id)}/>
          ))}
        </div>
      </div>

      {/* Resizer */}
      <div 
        className="hidden md:block w-1.5 cursor-col-resize z-30 transition-colors flex-shrink-0 -ml-[1px]"
        style={{ background: isResizing ? 'var(--accent-indigo)' : 'transparent' }}
        onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.5)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = isResizing ? 'var(--accent-indigo)' : 'transparent'; }}
      />

      {/* Detail pane */}
      <div className={`flex-1 overflow-y-auto bg-slate-900 md:bg-transparent absolute inset-0 md:relative z-40 md:z-auto ${selectedNote ? 'block' : 'hidden md:block'}`}>
        {selectedNote ? (
          <div className="p-4 md:p-6 max-w-2xl pb-24 md:pb-6">
            <button onClick={() => setSelectedNote(null)} className="md:hidden btn-ghost mb-4 flex items-center gap-2 -ml-2 text-xs">
              <ArrowLeft size={14}/> Back to notes
            </button>
            <div className="flex items-start md:items-center justify-between mb-4 gap-2">
              <h2 className="text-lg md:text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedNote.title}
              </h2>
              <button onClick={() => setSelectedNote(null)} className="hidden md:flex btn-ghost p-2">
                <X size={14}/>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {selectedNote.tags.map(tag => (
                <span key={tag} className="tag-pill">#{tag}</span>
              ))}
            </div>

            {selectedNote.summary && (
              <div className="rounded-lg p-3 mb-4 text-sm"
                style={{ background: 'rgba(99,102,241,0.08)', borderLeft: '2px solid #6366F1', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#A5B4FC', fontWeight: 500 }}>Summary: </span>
                {selectedNote.summary}
              </div>
            )}

            <div className="text-sm leading-relaxed mb-6"
              style={{ color: 'var(--text-primary)' }}>
              <RenderContent content={selectedNote.formatted_content || selectedNote.content} onLinkClick={openNoteByTitle} />
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}>
                    <Network size={14} color="#06B6D4"/> Connected notes ({connections.length})
                  </h3>
                  <button onClick={() => setShowAddConnection(!showAddConnection)} className="btn-ghost p-1 text-xs" title="Add manual connection">
                    <Plus size={14}/>
                  </button>
                </div>
                
                {showAddConnection && (
                  <div className="glass rounded-lg p-3 mb-3 flex gap-2">
                    {(() => {
                      const availableNotes = notes.filter(n => n.id !== selectedNote.id && !connections.find(c => c.id === n.id));
                      if (availableNotes.length === 0) {
                        return <span className="text-xs italic py-1.5" style={{ color: 'var(--text-muted)' }}>All available notes are already connected.</span>;
                      }
                      return (
                        <>
                          <select 
                            value={connectionNoteId} 
                            onChange={e => setConnectionNoteId(e.target.value)}
                            className="input-base text-xs flex-1 py-1.5 px-2"
                          >
                            <option value="">Select a note...</option>
                            {availableNotes.map(n => (
                              <option key={n.id} value={n.id}>{n.title}</option>
                            ))}
                          </select>
                          <button onClick={addManualConnection} disabled={!connectionNoteId} className="btn-primary px-3 py-1 text-xs">
                            Add
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
                
                <div className="space-y-2">
                  {connections.length === 0 ? (
                    <p className="text-xs italic mb-4" style={{ color: 'var(--text-muted)' }}>No connections yet.</p>
                  ) : (
                    connections.map((c: any) => (
                      <div key={c.id} className="glass rounded-lg p-3 text-xs cursor-pointer"
                        onClick={() => { const n = notes.find(n => n.id === c.id); if (n) openNote(n); }}
                        style={{ borderColor: 'rgba(6,182,212,0.2)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ color: similarityColor(c.similarity_score), fontWeight: 600 }}>
                              {(c.similarity_score * 100).toFixed(0)}%
                            </span>
                            <button onClick={(e) => removeManualConnection(e, c.id)} className="text-red-400 hover:text-red-300 ml-1">
                              <X size={12}/>
                            </button>
                          </div>
                        </div>
                        {c.connection_reason && (
                          <p style={{ color: 'var(--text-muted)' }}>{c.connection_reason}</p>
                        )}
                        <div className="mt-1.5 h-1 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="similarity-bar h-1" style={{ width: `${c.similarity_score * 100}%` }}/>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BookOpen size={32} className="mx-auto mb-3 opacity-20"/>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a note to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: Search ───────────────────────────────────────────────────────
function SearchTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); setAnalysis(''); return; }
    setLoading(true);
    setSearched(true);
    setAnalysis('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 500);
  }

  async function analyzeResults() {
    if (results.length === 0 || analyzing) return;
    setAnalyzing(true);
    setAnalysis('');
    
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: `Provide a comprehensive semantic analysis based on this query and these related notes: ${query}` }),
      });
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value);
          setAnalysis(fullText);
        }
      }
    } catch (e) {
      console.error(e);
      setAnalysis('Failed to generate analysis.');
    } finally {
      setAnalyzing(false);
    }
  }

  const EXAMPLES = [
    'What decisions did we make last month?',
    'Show me ideas about product strategy',
    'Technical architecture discussions',
    'Customer feedback themes',
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl w-full mx-auto pb-24 md:pb-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Semantic Search
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Search by meaning, not keywords. pgvector finds conceptually similar notes.
        </p>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}/>
        <input value={query} onChange={e => handleChange(e.target.value)}
          className="input-base" style={{ paddingLeft: '2.5rem' }} placeholder="Describe what you're looking for..."
          autoFocus/>
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
          style={{ color: '#6366F1' }}/>}
      </div>

      {!searched && (
        <div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Try searching for:</p>
          <div className="space-y-2">
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setQuery(ex); search(ex); }}
                className="w-full text-left glass glass-hover rounded-lg px-4 py-3 text-sm flex items-center gap-3 transition-all duration-150"
                style={{ color: 'var(--text-secondary)' }}>
                <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
                {ex}
                <ChevronRight size={12} className="ml-auto flex-shrink-0"/>
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && !loading && results.length === 0 && (
        <div className="text-center py-10">
          <AlertCircle size={24} className="mx-auto mb-3 opacity-40"/>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No notes matched this query. Try different phrasing or add more notes.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {results.length} semantically similar notes found
            </p>
            <button 
              onClick={analyzeResults} 
              disabled={analyzing}
              className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1.5"
              style={{ color: 'var(--accent-violet)', borderColor: 'rgba(139,92,246,0.3)' }}
            >
              {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {analyzing ? 'Analyzing...' : 'AI Semantic Analysis'}
            </button>
          </div>
          
          {(analysis || analyzing) && (
            <div className="glass rounded-xl p-4 mb-4 relative overflow-hidden" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Brain size={14} className="text-purple-400" /> Semantic Analysis
              </h3>
              <div className="text-sm ai-prose prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{analysis}</ReactMarkdown>
                {analyzing && <span className="ai-cursor" />}
              </div>
            </div>
          )}

          {results.map(r => (
            <div key={r.id} className="glass glass-hover rounded-xl p-4 transition-all duration-150">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{r.title}</h3>
                <span className="text-xs font-bold flex-shrink-0 px-2 py-0.5 rounded-full"
                  style={{
                    color: similarityColor(r.similarity),
                    background: `${similarityColor(r.similarity)}15`,
                    border: `1px solid ${similarityColor(r.similarity)}30`,
                  }}>
                  {(r.similarity * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs mb-3 line-clamp-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {r.content.slice(0, 200)}
              </p>
              <div className="mb-2 h-1 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                <div className="similarity-bar" style={{ width: `${r.similarity * 100}%` }}/>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {r.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="tag-pill" style={{ fontSize: 10 }}>#{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Ask AI ───────────────────────────────────────────────────────
function AskTab() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sourceCount, setSourceCount] = useState(0);
  const [history, setHistory] = useState<Array<{ q: string; a: string; sources: number }>>([]);
  const answerRef = useRef<HTMLDivElement>(null);

  async function ask() {
    if (!question.trim() || streaming) return;
    const q = question;
    setQuestion('');
    setAnswer('');
    setSourceCount(0);
    setStreaming(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      const srcCount = parseInt(res.headers.get('X-Source-Count') ?? '0');
      setSourceCount(srcCount);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullAnswer += chunk;
          setAnswer(fullAnswer);
          // Auto-scroll
          if (answerRef.current) {
            answerRef.current.scrollTop = answerRef.current.scrollHeight;
          }
        }
      }

      setHistory(h => [{ q, a: fullAnswer, sources: srcCount }, ...h.slice(0, 9)]);
    } finally {
      setStreaming(false);
    }
  }

  const STARTER_QUESTIONS = [
    'What are the most important decisions we\'ve made?',
    'What topics come up most in my notes?',
    'Summarize everything about our product strategy',
    'What risks or concerns have been mentioned?',
  ];

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main Q&A area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold mb-0.5 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}>
            <Sparkles size={16} color="#8B5CF6"/> Ask Your Knowledge Base
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            AI answers from your notes with citations.
          </p>
        </div>

        {/* Answer area */}
        <div ref={answerRef} className="flex-1 overflow-y-auto p-5">
          {!answer && !streaming && history.length === 0 && (
            <div className="space-y-2 max-w-lg">
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Starter questions:</p>
              {STARTER_QUESTIONS.map(q => (
                <button key={q} onClick={() => { setQuestion(q); }}
                  className="w-full text-left glass glass-hover rounded-lg px-4 py-3 text-sm flex items-center gap-3 transition-all duration-150"
                  style={{ color: 'var(--text-secondary)' }}>
                  <MessageSquare size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }}/>
                  {q}
                  <ChevronRight size={12} className="ml-auto flex-shrink-0"/>
                </button>
              ))}
            </div>
          )}

          {(answer || streaming) && (
            <div className="max-w-2xl">
              {sourceCount > 0 && (
                <div className="flex items-center gap-2 mb-3 text-xs"
                  style={{ color: '#06B6D4' }}>
                  <Network size={12}/> Synthesizing from {sourceCount} relevant notes
                </div>
              )}
              <div className="glass rounded-xl p-5 ai-prose">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                    <Brain size={12} color="white"/>
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#A5B4FC' }}>AI</span>
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none"
                  style={{ color: 'var(--text-primary)' }}>
                  <ReactMarkdown>{answer}</ReactMarkdown>
                  {streaming && <span className="ai-cursor"></span>}
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && !streaming && (
            <div className="mt-6 space-y-3 max-w-2xl">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Previous questions</p>
              {history.slice(1).map((h, i) => (
                <div key={i} className="glass rounded-lg p-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => { setAnswer(h.a); setSourceCount(h.sources); }}>
                  <p className="text-xs font-medium mb-1" style={{ color: '#A5B4FC' }}>{h.q}</p>
                  <p className="text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    {h.a.slice(0, 120)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t pb-24 md:pb-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-2">
            <input value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && ask()}
              className="input-base text-sm flex-1" placeholder="Ask anything about your notes..."
              disabled={streaming}/>
            <button onClick={ask} disabled={streaming || !question.trim()}
              className="btn-primary px-4 py-2 text-sm flex-shrink-0">
              {streaming
                ? <Loader2 size={14} className="animate-spin"/>
                : <><Sparkles size={14}/> Ask</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Connections Graph ────────────────────────────────────────────
function ConnectionsTab({ notes }: { notes: Note[] }) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [insights, setInsights] = useState('');
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height || 400
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [loading, nodes.length]);

  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteConnections, setNoteConnections] = useState<any[]>([]);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [connectionNoteId, setConnectionNoteId] = useState('');

  async function openNodeDetails(id: string) {
    const n = notes.find(n => n.id === id);
    if (!n) return;
    setSelectedNote(n);
    const res = await fetch(`/api/notes/${id}`);
    const data = await res.json();
    setNoteConnections(data.connections ?? []);
    setShowAddConnection(false);
    setConnectionNoteId('');
  }

  async function addManualConnection() {
    if (!connectionNoteId || !selectedNote) return;
    try {
      await fetch('/api/connections/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_note_id: selectedNote.id, to_note_id: connectionNoteId })
      });
      setShowAddConnection(false);
      setConnectionNoteId('');
      openNodeDetails(selectedNote.id);
      
      // Also refresh graph
      const res = await fetch('/api/connections');
      const data = await res.json();
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
    } catch (e) {
      console.error(e);
    }
  }

  async function removeManualConnection(toId: string) {
    if (!selectedNote) return;
    try {
      await fetch(`/api/connections/manual?from_note_id=${selectedNote.id}&to_note_id=${toId}`, {
        method: 'DELETE'
      });
      openNodeDetails(selectedNote.id);
      
      // Also refresh graph
      const res = await fetch('/api/connections');
      const data = await res.json();
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetch('/api/connections').then(r => r.json()).then(data => {
      setNodes(data.nodes ?? []);
      setEdges(data.edges ?? []);
      setStats(data.stats ?? null);
      setLoading(false);
    });
  }, []);

  async function generateInsights() {
    setLoadingInsights(true);
    try {
      const res = await fetch('/api/connections', { method: 'POST' });
      const data = await res.json();
      setInsights(data.insights);
    } finally {
      setLoadingInsights(false);
    }
  }

  // Simple force-directed layout using static positions
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const W = 600, H = 380;
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    const r = Math.min(W, H) * 0.35 * (0.5 + Math.random() * 0.5);
    nodePositions[n.id] = {
      x: W / 2 + r * Math.cos(angle),
      y: H / 2 + r * Math.sin(angle),
    };
  });

  const TAG_COLORS = ['#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EC4899'];

  return (
    <div className="flex flex-1 overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Knowledge Graph
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Auto-discovered semantic connections between your notes
            </p>
          </div>
          <button onClick={generateInsights} disabled={loadingInsights} className="btn-ghost text-xs">
            {loadingInsights
              ? <><Loader2 size={12} className="animate-spin"/> Generating...</>
              : <><Sparkles size={12}/> AI Insights</>}
          </button>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total Notes',    value: stats.note_count,                          color: '#6366F1' },
              { label: 'Connected',      value: stats.connected_notes,                      color: '#8B5CF6' },
              { label: 'Avg Similarity', value: `${((stats.avg_similarity ?? 0) * 100).toFixed(0)}%`, color: '#06B6D4' },
              { label: 'Top Tag',        value: stats.top_tag ? `#${stats.top_tag}` : '—', color: '#F59E0B' },
            ].map(({ label, value, color }) => (
              <div key={label} className="glass rounded-xl p-4 text-center">
                <div className="text-xl font-bold mb-0.5" style={{ color }}>{value}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* AI Insights */}
        {insights && (
          <div className="glass rounded-xl p-4 mb-6" style={{ borderColor: 'rgba(139,92,246,0.3)', borderLeft: '3px solid #8B5CF6' }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} color="#8B5CF6"/>
              <span className="text-xs font-medium" style={{ color: '#C4B5FD' }}>AI Knowledge Insights</span>
            </div>
            <pre className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit', lineHeight: 1.7 }}>
              {insights}
            </pre>
          </div>
        )}

        {/* Graph */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }}/>
          </div>
        ) : nodes.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Network size={36} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Add at least 3 notes to see connections appear
            </p>
          </div>
        ) : (
          <div className="glass rounded-xl overflow-hidden relative" style={{ height: 400 }} ref={containerRef}>
            {containerSize.width > 0 && (
              <ForceGraph 
                nodes={nodes} 
                edges={edges} 
                width={containerSize.width} 
                height={containerSize.height}
                onNodeClick={id => {
                  setConnectionNoteId(id);
                  setShowAddConnection(true);
                }}
              />
            )}
          </div>
        )}

        {/* Edge list */}
        {edges.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Strongest connections</p>
            {edges.slice(0, 6).map((e, i) => {
              const from = nodes.find(n => n.id === e.from_note_id);
              const to   = nodes.find(n => n.id === e.to_note_id);
              if (!from || !to) return null;
              return (
                <div key={i} className="glass rounded-lg p-3 text-xs flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                      {from.title}
                    </span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>↔</span>
                    <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                      {to.title}
                    </span>
                  </div>
                  <span className="font-bold flex-shrink-0"
                    style={{ color: similarityColor(e.similarity_score) }}>
                    {(e.similarity_score * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Detail Pane Slide-over */}
      <div className={`w-full md:w-[400px] flex flex-col absolute inset-y-0 right-0 z-40 transform transition-transform duration-300 shadow-2xl border-l`}
           style={{ 
             background: 'var(--bg-surface)', 
             borderColor: 'var(--border)',
             transform: selectedNote ? 'translateX(0)' : 'translateX(100%)'
           }}>
        {selectedNote && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-lg line-clamp-1" style={{ color: 'var(--text-primary)' }}>{selectedNote.title}</h2>
              <button onClick={() => setSelectedNote(null)} className="btn-ghost p-1.5"><X size={16}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedNote.tags.map(tag => (
                  <span key={tag} className="tag-pill">#{tag}</span>
                ))}
              </div>

              {selectedNote.summary && (
                <div className="rounded-lg p-3 mb-4 text-sm"
                  style={{ background: 'rgba(99,102,241,0.08)', borderLeft: '2px solid #6366F1', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#A5B4FC', fontWeight: 500 }}>Summary: </span>
                  {selectedNote.summary}
                </div>
              )}

              <div className="text-sm leading-relaxed mb-6 prose prose-sm dark:prose-invert max-w-none"
                style={{ color: 'var(--text-primary)' }}>
                <RenderContent content={selectedNote.formatted_content || selectedNote.content} onLinkClick={() => {}} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium flex items-center gap-2"
                    style={{ color: 'var(--text-secondary)' }}>
                    <Network size={14} color="#06B6D4"/> Connected notes ({noteConnections.length})
                  </h3>
                  <button onClick={() => setShowAddConnection(!showAddConnection)} className="btn-ghost p-1 text-xs" title="Add manual connection">
                    <Plus size={14}/>
                  </button>
                </div>
                
                {showAddConnection && (
                  <div className="glass rounded-lg p-3 mb-3 flex gap-2">
                    {(() => {
                      const availableNotes = notes.filter(n => n.id !== selectedNote.id && !noteConnections.find(c => c.id === n.id));
                      if (availableNotes.length === 0) {
                        return <span className="text-xs italic py-1.5" style={{ color: 'var(--text-muted)' }}>All available notes are already connected.</span>;
                      }
                      return (
                        <>
                          <select 
                            value={connectionNoteId} 
                            onChange={e => setConnectionNoteId(e.target.value)}
                            className="input-base text-xs flex-1 py-1.5 px-2"
                          >
                            <option value="">Select a note...</option>
                            {availableNotes.map(n => (
                              <option key={n.id} value={n.id}>{n.title}</option>
                            ))}
                          </select>
                          <button onClick={addManualConnection} disabled={!connectionNoteId} className="btn-primary px-3 py-1 text-xs">
                            Add
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
                
                <div className="space-y-2">
                  {noteConnections.length === 0 ? (
                    <p className="text-xs italic mb-4" style={{ color: 'var(--text-muted)' }}>No connections yet.</p>
                  ) : (
                    noteConnections.map((c: any) => (
                      <div key={c.id} className="glass rounded-lg p-3 text-xs cursor-pointer"
                        onClick={() => openNodeDetails(c.id)}
                        style={{ borderColor: 'rgba(6,182,212,0.2)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c.title}</span>
                          <div className="flex items-center gap-2">
                            <span style={{ color: similarityColor(c.similarity_score), fontWeight: 600 }}>
                              {(c.similarity_score * 100).toFixed(0)}%
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); removeManualConnection(c.id); }} className="text-red-400 hover:text-red-300 ml-1">
                              <X size={12}/>
                            </button>
                          </div>
                        </div>
                        {c.connection_reason && (
                          <p style={{ color: 'var(--text-muted)' }}>{c.connection_reason}</p>
                        )}
                        <div className="mt-1.5 h-1 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="similarity-bar h-1" style={{ width: `${c.similarity_score * 100}%` }}/>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// ── Tab: Organize ─────────────────────────────────────────────────────
function OrganizeTab({ notes, onRefresh }: { notes: Note[]; onRefresh: () => void }) {
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDuplicates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notes/duplicates');
      const data = await res.json();
      setDuplicates(data.duplicates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDuplicates(); }, [fetchDuplicates]);

  async function handleMerge(keepId: string, deleteId: string) {
    await fetch('/api/notes/duplicates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepId, deleteId }),
    });
    fetchDuplicates();
    onRefresh();
  }

  const [exporting, setExporting] = useState(false);

  async function exportVault() {
    setExporting(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      notes.forEach(n => {
        let title = n.title.replace(/[^a-zA-Z0-9-_\s]/g, '').trim();
        if (!title) title = 'Untitled';
        
        const tagsStr = n.tags.map(t => '"' + t + '"').join(', ');
        const frontmatter = '---\n' +
          'title: "' + n.title.replace(/"/g, '\\"') + '"\n' +
          'tags: [' + tagsStr + ']\n' +
          'summary: "' + (n.summary || '').replace(/"/g, '\\"') + '"\n' +
          '---\n';
          
        const mdContent = frontmatter + '\n# ' + n.title + '\n\n' + n.content;
        zip.file(`${title}.md`, mdContent);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Recall-Vault.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to export vault');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full pb-24 md:pb-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Cleanup & Organize
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Find and merge duplicate notes.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }}/>
        </div>
      ) : duplicates.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Sparkles size={36} className="mx-auto mb-3 opacity-30" color="#10B981"/>
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Your knowledge base is clean!</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No duplicate notes found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            Found {duplicates.length} pair(s) of highly similar notes.
          </p>
          {duplicates.map((pair, i) => (
            <div key={i} className="glass rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                  {(pair.similarity * 100).toFixed(1)}% Match
                </span>
                <div className="flex gap-2">
                  <button onClick={() => handleMerge(pair.id1, pair.id2)}
                    className="btn-ghost text-xs py-1 px-3">
                    Keep #1, Delete #2
                  </button>
                  <button onClick={() => handleMerge(pair.id2, pair.id1)}
                    className="btn-ghost text-xs py-1 px-3">
                    Keep #2, Delete #1
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Note #1</div>
                  <h4 className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{pair.title1}</h4>
                  <p className="text-xs line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{pair.content1}</p>
                </div>
                <div className="border rounded-lg p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Note #2</div>
                  <h4 className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{pair.title2}</h4>
                  <p className="text-xs line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{pair.content2}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Local Export Feature */}
      <div className="mt-8 mb-6">
        <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Local Vault Export
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          For absolute security and data ownership, download your entire knowledge base as a local folder of raw Markdown (.md) files.
        </p>
      </div>

      <div className="glass rounded-xl p-6 mb-6 text-center">
        <BookOpen size={36} className="mx-auto mb-3 opacity-60" style={{ color: '#8B5CF6' }}/>
        <h3 className="font-medium text-base mb-1" style={{ color: 'var(--text-primary)' }}>Export to Markdown</h3>
        <p className="text-xs mb-4 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
          Downloads a .zip file containing all your notes as .md files, complete with YAML frontmatter tags and summaries.
        </p>
        <button className="btn-primary py-2 px-6" onClick={exportVault} disabled={exporting || notes.length === 0}>
          {exporting ? (
            <><Loader2 size={16} className="animate-spin" /> Packaging Vault...</>
          ) : (
            <><Download size={16} /> Download {notes.length} Notes as .md</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Tab: Account ──────────────────────────────────────────────────────
function AccountTab() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('3m');

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (Object.keys(data).length > 0) setSession(data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto w-full pb-24 md:pb-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Account Settings
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage your account details and subscription.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin" style={{ color: '#6366F1' }}/>
        </div>
      ) : session?.user ? (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 relative overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <div className="flex items-center gap-4 mb-6">
              {session.user.image ? (
                <img src={session.user.image} alt="Profile" className="w-16 h-16 rounded-full border-2" style={{ borderColor: 'var(--border)' }}/>
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold bg-indigo-500/20 text-indigo-400 border-2" style={{ borderColor: 'var(--border)' }}>
                  {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{session.user.name || 'User'}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{session.user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Account ID</label>
                <div className="bg-black/20 dark:bg-black/40 px-3 py-2 rounded-lg text-sm font-mono flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>{session.user.id || 'Unknown ID'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-6" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Zap size={18} className="text-amber-500" /> Subscription Plan
            </h3>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-center justify-between mb-4">
              <div>
                <div className="font-bold text-amber-500 mb-1">Free Tier</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>You are currently on the free beta tier.</div>
              </div>
              <button 
                onClick={() => setShowUpgrade(true)}
                className="btn-primary py-2 px-4" 
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FB923C)', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass rounded-xl p-8 text-center text-red-400">
          Not signed in.
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="glass rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative" style={{ background: 'var(--bg-surface)' }}>
            <button 
              onClick={() => setShowUpgrade(false)} 
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors z-10"
              style={{ color: 'var(--text-primary)' }}
            >
              <X size={20} />
            </button>
            
            <div className="p-6 md:p-8 pb-6 border-b flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.1))', borderColor: 'var(--border)' }}>
              <h2 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
                <Sparkles className="text-amber-500" size={28} /> Upgrade to Premium
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Unlock the full potential of your knowledge base with advanced AI and security features.
              </p>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="font-semibold mb-4 text-lg" style={{ color: 'var(--text-primary)' }}>Premium Features</h3>
                  <ul className="space-y-4">
                    <li className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check size={14} className="text-emerald-500" /></div>
                      <span><b>No Ads</b> anywhere in the application</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check size={14} className="text-emerald-500" /></div>
                      <span><b>Extended AI Features</b> (GPT-4 Access & Uncapped Usage)</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check size={14} className="text-emerald-500" /></div>
                      <span><b>Advanced Security</b> & End-to-End Encryption</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check size={14} className="text-emerald-500" /></div>
                      <span><b>Priority Support</b> & Early Feature Access</span>
                    </li>
                    <li className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <div className="bg-emerald-500/20 p-1.5 rounded-full"><Check size={14} className="text-emerald-500" /></div>
                      <span><b>Increased Database Limits</b> (100x More Storage)</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-4 text-lg" style={{ color: 'var(--text-primary)' }}>Select a Plan</h3>
                  <div className="space-y-3">
                    <button 
                      onClick={() => setSelectedPlan('1m')}
                      className={`w-full text-left p-3.5 rounded-xl transition-all flex justify-between items-center group ${selectedPlan === '1m' ? 'border-2 border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border hover:border-amber-500 hover:bg-amber-500/5'}`} 
                      style={{ borderColor: selectedPlan === '1m' ? undefined : 'var(--border)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>1 Month</span>
                      <span className="font-bold text-amber-500 group-hover:scale-110 transition-transform">$1.00</span>
                    </button>
                    
                    <button 
                      onClick={() => setSelectedPlan('3m')}
                      className={`w-full text-left p-3.5 rounded-xl transition-all flex justify-between items-center relative ${selectedPlan === '3m' ? 'border-2 border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border hover:border-amber-500 hover:bg-amber-500/5'}`}
                      style={{ borderColor: selectedPlan === '3m' ? undefined : 'var(--border)' }}>
                      <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">Most Popular</div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>3 Months</span>
                      <span className="font-bold text-amber-500 flex items-center gap-2">
                        $2.50 <span className="text-xs line-through opacity-50" style={{ color: 'var(--text-muted)' }}>$3.00</span>
                      </span>
                    </button>
                    
                    <button 
                      onClick={() => setSelectedPlan('6m')}
                      className={`w-full text-left p-3.5 rounded-xl transition-all flex justify-between items-center group ${selectedPlan === '6m' ? 'border-2 border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border hover:border-amber-500 hover:bg-amber-500/5'}`}
                      style={{ borderColor: selectedPlan === '6m' ? undefined : 'var(--border)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>6 Months</span>
                      <span className="font-bold text-amber-500 group-hover:scale-110 transition-transform">$4.50</span>
                    </button>
                    
                    <button 
                      onClick={() => setSelectedPlan('1y')}
                      className={`w-full text-left p-3.5 rounded-xl transition-all flex justify-between items-center group ${selectedPlan === '1y' ? 'border-2 border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'border hover:border-amber-500 hover:bg-amber-500/5'}`}
                      style={{ borderColor: selectedPlan === '1y' ? undefined : 'var(--border)' }}>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>1 Year</span>
                      <span className="font-bold text-amber-500 flex items-center gap-2 group-hover:scale-105 transition-transform">
                        $8.00 <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full ml-1">Save 33%</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => { window.location.href = `/checkout?plan=${selectedPlan}`; }}
                className="w-full btn-primary py-4 text-base font-bold justify-center rounded-xl" 
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FB923C)', boxShadow: '0 8px 20px rgba(245,158,11,0.3)' }}
              >
                Continue to Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root Dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('notes');
  const [noteIdToOpen, setNoteIdToOpen] = useState<string | null>(null);
  const [notes, setNotes]         = useState<Note[]>([]);
  const [allTags, setAllTags]     = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [qaCount, setQaCount]     = useState(0);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/notes');
      const data = await res.json();
      setNotes(data.notes ?? []);
      setAllTags(data.tags ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden neural-bg" style={{ background: 'var(--bg-base)' }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab}
        noteCount={notes.length} qaCount={qaCount}/>

      <main className="flex-1 flex overflow-hidden pb-16 md:pb-0 relative z-0 w-full">
        <div className="absolute top-4 right-4 z-30 hidden md:block">
          <div className="rounded-lg backdrop-blur-md" style={{ background: 'var(--bg-surface)' }}>
            <ThemeToggle />
          </div>
        </div>
        {activeTab === 'notes'       && <NotesTab notes={notes} allTags={allTags} loading={loading} onRefresh={fetchNotes} noteIdToOpen={noteIdToOpen} setNoteIdToOpen={setNoteIdToOpen}/>}
        {activeTab === 'search'      && <SearchTab/>}
        {activeTab === 'ask'         && <AskTab/>}
        {activeTab === 'connections' && <ConnectionsTab notes={notes}/>}
        {activeTab === 'organize'    && <OrganizeTab notes={notes} onRefresh={fetchNotes}/>}
        {activeTab === 'account'     && <AccountTab/>}
      </main>
    </div>
  );
}
