'use client';

/**
 * Improved Strategy Builder v2
 * 
 * Features:
 * - Template selection
 * - Three creation modes (Template / Visual Builder / AI Description)
 * - Visual drag-and-drop editor
 * - Better UX and guidance
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { StrategyDsl } from '@/lib/strategy-builder/dsl-schema';
import { STRATEGY_TEMPLATES, type StrategyTemplate } from '@/lib/strategy-builder/templates';
import ImprovedStrategyEditor from './components/improved-strategy-editor';

interface StrategyBuilderClientV2Props {
  userId: string;
}

type CreationMode = 'select' | 'template' | 'visual' | 'ai';

export default function StrategyBuilderClientV2({ userId }: StrategyBuilderClientV2Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<CreationMode>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<StrategyTemplate | null>(null);
  const [dsl, setDsl] = useState<StrategyDsl | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editStrategyId, setEditStrategyId] = useState<string | null>(null);
  const [editStrategyName, setEditStrategyName] = useState<string | null>(null);

  // Load existing strategy for editing (if edit param in URL)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      loadStrategyForEdit(editId);
    }
  }, [searchParams]);

  const loadStrategyForEdit = async (strategyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/strategy-builder/get?id=${strategyId}`);
      const data = await response.json();
      
      if (data.success && data.strategy) {
        setEditStrategyId(strategyId);
        setEditStrategyName(data.strategy.name);
        setDsl(data.strategy.dsl);
        setMode('visual'); // Go straight to visual editor
      } else {
        setError(data.error || 'Failed to load strategy');
        setMode('select');
      }
    } catch (err) {
      setError('Failed to load strategy');
      setMode('select');
    } finally {
      setLoading(false);
    }
  };

  // Load template
  const handleSelectTemplate = (template: StrategyTemplate) => {
    setSelectedTemplate(template);
    setDsl({ ...template.dsl }); // Clone the DSL
    setMode('visual'); // Switch to visual editor to customize the template
  };

  // Start from scratch
  const handleBuildFromScratch = () => {
    setDsl({
      name: '',
      direction: 'long',
      timeframe: '1day',
      eligibility: {},
      trigger: {
        type: 'breakout',
        level: 'ema20',
        description: '',
      },
      stop: {
        type: 'atr',
        value: 'entry-1.5*ATR',
      },
      targets: [
        { level: 'entry+2*ATR', label: 'T1' },
      ],
    });
    setMode('visual');
  };

  // Parse from AI description
  const handleParseAI = async () => {
    if (!aiInput.trim()) {
      setError('Please describe your strategy');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/strategy-builder/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiInput }),
      });

      const data = await response.json();

      if (data.success) {
        setDsl(data.dsl);
        setMode('visual'); // Switch to visual editor to review/edit
      } else {
        setError(data.errors?.join('\n') || 'Failed to parse strategy');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Save or update strategy
  const handleSave = async () => {
    if (!dsl) return;

    if (!dsl.name.trim()) {
      setError('Please enter a strategy name');
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const isUpdate = !!editStrategyId;
      const response = await fetch('/api/strategy-builder/save', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isUpdate && { id: editStrategyId }), // Include ID for updates
          dsl,
          name: dsl.name,
          description: dsl.description,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaved(true);
        setTimeout(() => {
          // Navigate back to manage page after edit, or reset for new strategy
          if (isUpdate) {
            router.push('/strategies/manage');
          } else {
            setMode('select');
            setDsl(null);
            setSelectedTemplate(null);
            setAiInput('');
            setSaved(false);
          }
        }, 2000);
      } else {
        setError(data.error || `Failed to ${isUpdate ? 'update' : 'save'} strategy`);
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update DSL
  const updateDsl = (updates: Partial<StrategyDsl>) => {
    if (!dsl) return;
    setDsl({ ...dsl, ...updates });
  };

  // Mode Selection Screen
  if (mode === 'select') {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            Create Your Trading Strategy
          </h2>
          <p className="text-blue-200 text-lg">
            Choose how you want to build your strategy
          </p>
        </div>

        {/* Three Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Option 1: Templates */}
          <button
            onClick={() => setMode('template')}
            className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-lg rounded-2xl p-8 border border-green-500/30 hover:border-green-500/50 transition-all group shadow-xl hover:shadow-green-500/20 text-left"
          >
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📋</div>
            <h3 className="text-2xl font-bold text-white mb-3">Start from Template</h3>
            <p className="text-blue-200 mb-4">
              Choose from 6 pre-built strategies like "Breakout & Retest" or "EMA Pullback". Fastest way to get started!
            </p>
            <div className="flex items-center text-green-300 font-medium">
              Browse Templates
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
                ⚡ Fast
              </span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                ✅ Tested
              </span>
            </div>
          </button>

          {/* Option 2: Visual Builder */}
          <button
            onClick={handleBuildFromScratch}
            className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-lg rounded-2xl p-8 border border-blue-500/30 hover:border-blue-500/50 transition-all group shadow-xl hover:shadow-blue-500/20 text-left"
          >
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🎨</div>
            <h3 className="text-2xl font-bold text-white mb-3">Build from Scratch</h3>
            <p className="text-blue-200 mb-4">
              Use our visual editor with dropdowns and tabs. No coding needed - just select options and build your strategy step-by-step.
            </p>
            <div className="flex items-center text-blue-300 font-medium">
              Start Building
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
                🎯 Flexible
              </span>
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                💡 Visual
              </span>
            </div>
          </button>

          {/* Option 3: AI Description */}
          <button
            onClick={() => setMode('ai')}
            className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/30 hover:border-purple-500/50 transition-all group shadow-xl hover:shadow-purple-500/20 text-left"
          >
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🤖</div>
            <h3 className="text-2xl font-bold text-white mb-3">Describe in Words</h3>
            <p className="text-blue-200 mb-4">
              Just describe your strategy in plain English. AI will convert it to a structured format that you can review and customize.
            </p>
            <div className="flex items-center text-purple-300 font-medium">
              Use AI Parser
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="mt-4 flex gap-2">
              <span className="px-2 py-1 bg-pink-500/20 text-pink-300 text-xs rounded-full border border-pink-500/30">
                🚀 Easy
              </span>
              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30">
                🤖 AI-Powered
              </span>
            </div>
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
          <div className="flex items-start gap-3">
            <div className="text-3xl">💡</div>
            <div>
              <h4 className="text-lg font-bold text-white mb-2">New to Strategy Building?</h4>
              <p className="text-blue-200 text-sm mb-3">
                We recommend starting with a template! Templates like "Breakout & Retest" are battle-tested strategies that you can customize to your needs. It's the fastest way to learn.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-blue-300">
                  ✓ All templates include risk management
                </span>
                <span className="text-xs text-blue-300">
                  ✓ Can be customized after loading
                </span>
                <span className="text-xs text-blue-300">
                  ✓ Works with market scanner
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Template Selection Screen
  if (mode === 'template') {
    const beginnerTemplates = STRATEGY_TEMPLATES.filter(t => t.difficulty === 'beginner');
    const intermediateTemplates = STRATEGY_TEMPLATES.filter(t => t.difficulty === 'intermediate');
    const advancedTemplates = STRATEGY_TEMPLATES.filter(t => t.difficulty === 'advanced');

    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setMode('select')}
          className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Options
        </button>

        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Choose a Template</h2>
          <p className="text-blue-200">
            Select a pre-built strategy to customize, or build from scratch
          </p>
        </div>

        {/* Beginner Templates */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xl font-bold text-white">Beginner Templates</h3>
            <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full border border-green-500/30">
              Recommended for new traders
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {beginnerTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-green-500/50 transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-lg font-bold text-white group-hover:text-green-300 transition-colors">
                    {template.name}
                  </h4>
                  <svg className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-blue-200 text-sm mb-4">
                  {template.description}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full border border-green-500/30">
                    ⭐ Beginner
                  </span>
                  <span className="text-blue-300">
                    {template.dsl.timeframe}
                  </span>
                  <span className="text-blue-300">
                    {template.dsl.direction === 'long' ? '📈 Long' : '📉 Short'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Intermediate Templates */}
        {intermediateTemplates.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xl font-bold text-white">Intermediate Templates</h3>
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30">
                Pattern-based strategies
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {intermediateTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-yellow-500/50 transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-bold text-white group-hover:text-yellow-300 transition-colors">
                      {template.name}
                    </h4>
                    <svg className="w-5 h-5 text-yellow-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="text-blue-200 text-sm mb-4">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">
                      ⚡ Intermediate
                    </span>
                    <span className="text-blue-300">
                      {template.dsl.timeframe}
                    </span>
                    <span className="text-blue-300">
                      {template.dsl.direction === 'long' ? '📈 Long' : '📉 Short'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Templates */}
        {advancedTemplates.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-xl font-bold text-white">Advanced Templates</h3>
              <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full border border-red-500/30">
                Complex strategies
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {advancedTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 hover:border-red-500/50 transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-bold text-white group-hover:text-red-300 transition-colors">
                      {template.name}
                    </h4>
                    <svg className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="text-blue-200 text-sm mb-4">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-red-500/20 text-red-300 rounded-full border border-red-500/30">
                      🔥 Advanced
                    </span>
                    <span className="text-blue-300">
                      {template.dsl.timeframe}
                    </span>
                    <span className="text-blue-300">
                      {template.dsl.direction === 'long' ? '📈 Long' : '📉 Short'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // AI Description Screen
  if (mode === 'ai') {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setMode('select')}
          className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Options
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-xl p-6 border border-purple-500/30">
          <h2 className="text-2xl font-bold text-white mb-2">🤖 AI Strategy Parser</h2>
          <p className="text-blue-200">
            Describe your trading strategy in plain English and our AI will convert it into a structured format.
          </p>
        </div>

        {/* Input */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <label className="block text-sm font-medium text-blue-200 mb-3">
            Describe Your Strategy
          </label>
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Example: Go long on daily timeframe when EMA20 > EMA50, RSI between 40-70, price pulls back within 1.5 ATR of EMA50, confirmed by bullish engulfing candle, stop 1.5 ATR below entry, targets at 2 and 4 ATR..."
            rows={8}
            className="w-full px-4 py-3 bg-slate-900/50 border border-white/20 rounded-lg text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          
          <button
            onClick={handleParseAI}
            disabled={loading || !aiInput.trim()}
            className="mt-4 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Parsing...
              </span>
            ) : (
              '🤖 Parse Strategy'
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Examples */}
        <div className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-6 border border-blue-500/30">
          <h3 className="text-lg font-bold text-white mb-3">💡 Example Descriptions</h3>
          <div className="space-y-3 text-sm text-blue-200">
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <strong className="text-white">Breakout & Retest:</strong> "Wait for breakout above resistance with 1.5x volume, then enter when price retests the level and bounces with bullish candle"
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <strong className="text-white">EMA Pullback:</strong> {`"Go long when price pulls back to EMA50 in uptrend (EMA20 > EMA50 > EMA200), RSI 40-70, stop 1.5 ATR below"`}
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <strong className="text-white">Pattern Breakout:</strong> "Enter on double bottom breakout above neckline with volume, stop at support, target at pattern height"
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Visual Editor Screen (for both template and from-scratch)
  if (mode === 'visual' && dsl) {
    const isEditMode = !!editStrategyId;
    
    return (
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                if (isEditMode) {
                  router.push('/strategies/manage');
                } else {
                  setMode('select');
                }
              }}
              className="flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors mb-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {isEditMode ? 'Back to Manage' : 'Back to Options'}
            </button>
            
            {/* Show different headers for edit vs create */}
            {isEditMode ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-300">Editing:</span>
                <span className="text-lg font-bold text-white">{editStrategyName}</span>
                <span className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30">
                  ✏️ Edit Mode
                </span>
              </div>
            ) : selectedTemplate ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-blue-300">Customizing:</span>
                <span className="text-lg font-bold text-white">{selectedTemplate.name}</span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                  {selectedTemplate.difficulty}
                </span>
              </div>
            ) : null}
          </div>
          
          <button
            onClick={handleSave}
            disabled={loading || !dsl.name.trim()}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isEditMode ? 'Updating...' : 'Saving...'}
              </>
            ) : (
              <>
                {isEditMode ? '✏️ Update Strategy' : '💾 Save Strategy'}
              </>
            )}
          </button>
        </div>

        {/* Success Message */}
        {saved && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-300">
              <span className="text-2xl">✅</span>
              <span className="font-semibold">
                {isEditMode ? 'Strategy updated successfully! Redirecting...' : 'Strategy saved successfully!'}
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-300">
              <span className="text-2xl">❌</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Visual Editor */}
        <ImprovedStrategyEditor dsl={dsl} onChange={updateDsl} />
      </div>
    );
  }

  return null;
}

