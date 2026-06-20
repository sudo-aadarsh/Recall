'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Brain, Search, Zap, Network, ArrowRight, Star,
  MessageSquare, Tag, GitBranch, Lock, Globe, ChevronRight, Moon, Sun
} from 'lucide-react';

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

// ── Animated neural nodes (signature visual element) ─────────────────
function NeuralCanvas() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0"/>
          </radialGradient>
        </defs>
        {/* Connection lines */}
        {[
          [180,120,420,280],[420,280,680,150],[680,150,920,320],
          [180,120,320,380],[320,380,580,420],[580,420,820,280],
          [100,300,280,450],[280,450,520,380],[720,400,920,320],
          [420,280,580,420],[580,420,720,400],
        ].map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#6366F1" strokeWidth="0.5" strokeOpacity="0.3"
            strokeDasharray="4 8">
            <animate attributeName="stroke-dashoffset"
              from="0" to="-24" dur={`${3 + i * 0.4}s`} repeatCount="indefinite"/>
          </line>
        ))}
        {/* Nodes */}
        {[
          [180,120,6],[420,280,8],[680,150,5],[920,320,7],
          [320,380,5],[580,420,6],[820,280,4],[280,450,7],
          [100,300,4],[720,400,5],
        ].map(([cx,cy,r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#6366F1" opacity="0.6">
            <animate attributeName="opacity"
              values="0.3;0.8;0.3" dur={`${2 + i * 0.3}s`} repeatCount="indefinite"/>
            <animate attributeName="r"
              values={`${r};${(r as number)+2};${r}`} dur={`${2.5 + i * 0.2}s`} repeatCount="indefinite"/>
          </circle>
        ))}
      </svg>
    </div>
  );
}

// ── Typing animation for the demo ─────────────────────────────────────
const DEMO_QUERIES = [
  "What did we decide about the Q3 pricing strategy?",
  "Show me everything related to the Aurora migration",
  "What are the key risks our team identified last month?",
  "Summarize all notes tagged #product-roadmap",
];

function TypingDemo() {
  const [queryIdx, setQueryIdx] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState<'typing'|'pausing'|'erasing'>('typing');

  useEffect(() => {
    const target = DEMO_QUERIES[queryIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (displayed.length < target.length) {
        timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 45);
      } else {
        timeout = setTimeout(() => setPhase('pausing'), 2000);
      }
    } else if (phase === 'pausing') {
      timeout = setTimeout(() => setPhase('erasing'), 500);
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(d => d.slice(0,-1)), 18);
      } else {
        setQueryIdx(i => (i + 1) % DEMO_QUERIES.length);
        setPhase('typing');
      }
    }
    return () => clearTimeout(timeout);
  }, [displayed, phase, queryIdx]);

  return (
    <div className="input-base text-sm font-mono mt-4 min-h-[44px] h-auto flex items-start sm:items-center py-3">
      <Search size={14} className="mr-2 flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: 'var(--text-muted)' }}/>
      <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{displayed}</span>
      <span className="ai-cursor flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: 'var(--accent-violet)' }}></span>
    </div>
  );
}

// ── Feature cards ────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Brain, color: '#6366F1',
    title: 'Ask Anything',
    desc: 'Natural language Q&A over your entire knowledge base. "What did we decide about pricing?" — answered instantly with citations.',
  },
  {
    icon: Network, color: '#8B5CF6',
    title: 'Auto Connections',
    desc: 'pgvector finds semantic links between notes automatically. Discover how your meeting from Tuesday relates to a decision from 3 months ago.',
  },
  {
    icon: Zap, color: '#06B6D4',
    title: 'Instant Tagging',
    desc: 'AI analyzes every note the moment you save it. Auto-generates a title, one-line summary, and relevant tags. Zero effort.',
  },
  {
    icon: Search, color: '#F59E0B',
    title: 'Semantic Search',
    desc: 'Finds what you mean, not just what you typed. Search "customer retention" and find notes about "churn" and "user engagement".',
  },
  {
    icon: GitBranch, color: '#10B981',
    title: 'Knowledge Graph',
    desc: 'Visual map of your ideas. See clusters, gaps, and unexpected connections across your entire knowledge base at a glance.',
  },
  {
    icon: Globe, color: '#EC4899',
    title: 'Team Workspace',
    desc: 'Shared knowledge base for your whole team. Aurora PostgreSQL keeps everyone in sync globally with strong consistency.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen neural-bg" style={{ background: 'var(--bg-base)' }}>

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="border-b sticky top-0 z-50" style={{
        borderColor: 'var(--border)',
        background: 'var(--bg-nav)',
        backdropFilter: 'blur(12px)',
      }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
              <Brain size={16} color="white"/>
            </div>
            <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
              Recall
            </span>
          </a>

          <div className="flex items-center gap-3">
            <ThemeToggle iconOnly={true} />
            <Link href="/dashboard" className="btn-primary text-sm py-2 px-4 whitespace-nowrap h-9 flex items-center">
              Open App <ArrowRight size={14} className="ml-1"/>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 px-6 text-center overflow-hidden">
        <NeuralCanvas/>

        <div className="max-w-3xl mx-auto relative">
          <div className="inline-flex items-center gap-2 tag-pill mb-6 text-[10px] md:text-xs px-3 py-1.5" style={{
            borderColor: 'rgba(99,102,241,0.4)',
            background: 'rgba(99,102,241,0.1)',
            color: '#A5B4FC',
          }}>
            <Zap size={11}/> Built with AI + Aurora PostgreSQL + pgvector
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Your knowledge base,<br className="hidden sm:block"/>{' '}
            <span className="gradient-text">finally queryable.</span>
          </h1>

          <p className="text-base md:text-lg mb-8 max-w-xl mx-auto px-4 md:px-0" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Paste notes. Ask questions in plain English. AI finds the answer from your
            own knowledge base — with citations. No more digging through folders.
          </p>

          {/* Typing demo */}
          <div className="max-w-lg mx-auto glass rounded-xl p-4 mb-8 text-left">
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ask your knowledge base:</p>
            <TypingDemo/>
            <div className="mt-3 p-3 rounded-lg text-xs" style={{
              background: 'rgba(99,102,241,0.08)',
              borderLeft: '2px solid var(--accent-indigo)',
            }}>
              <span style={{ color: '#A5B4FC' }}>AI:</span>
              <span style={{ color: 'var(--text-secondary)' }}> Based on <strong style={{ color: 'var(--text-primary)' }}>[Source 2]</strong> and <strong style={{ color: 'var(--text-primary)' }}>[Source 5]</strong>, your team decided to...</span>
              <span className="ai-cursor"></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard" className="btn-primary text-base px-6 py-3">
              Start for free <ArrowRight size={16}/>
            </Link>
            <a href="#how-it-works" className="btn-ghost text-base px-6 py-3">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* ── Stack badges ───────────────────────────────────────────── */}
      <section className="py-10 border-y" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs mb-6 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Powered by
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: 'AI Models', color: '#D97706' },
              { name: 'Aurora PostgreSQL', color: '#FF9900' },
              { name: 'pgvector HNSW Index', color: '#6366F1' },
              { name: 'Vercel Edge Network', color: 'var(--text-primary)' },
              { name: 'Next.js 14', color: '#94A3B8' },
              { name: 'text-embedding-3-small', color: '#06B6D4' },
            ].map((item: { name: string; color: string; bg?: string }) => (
              <div key={item.name} className="glass rounded-lg px-4 py-2 text-xs font-medium"
                style={{ color: item.color, borderColor: `${item.color}30`, background: item.bg ? `${item.bg}10` : undefined }}>
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className="py-20 px-6" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              What makes Recall different
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Not a note-taking app. An <em>institutional knowledge engine.</em>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="glass glass-hover rounded-xl p-5 transition-all duration-200">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                  <Icon size={18} color={color}/>
                </div>
                <h3 className="font-semibold mb-2 text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto glass rounded-2xl p-12"
          style={{ borderColor: 'rgba(99,102,241,0.3)', boxShadow: '0 0 60px rgba(99,102,241,0.1)' }}>
          <Brain size={40} className="mx-auto mb-4" style={{ color: '#6366F1' }}/>
          <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Start building your Recall
          </h2>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
            Add your first note in 30 seconds. Watch AI make it instantly searchable and connected.
          </p>
          <Link href="/dashboard" className="btn-primary text-base px-8 py-3">
            Open Dashboard <ArrowRight size={16}/>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-6 text-center text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        © {new Date().getFullYear()} Recall. All rights reserved.
      </footer>
    </div>
  );
}
