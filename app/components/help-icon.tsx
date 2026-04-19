'use client';

/**
 * Reusable Help Icon Component
 * Opens help modal for specific sections
 */

interface HelpIconProps {
  onClick: () => void;
  tooltip?: string;
  className?: string;
}

export default function HelpIcon({ onClick, tooltip = 'Click for help', className = '' }: HelpIconProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary transition-all group relative ${className}`}
      type="button"
      title={tooltip}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      {tooltip && (
        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-surface-4 text-text-primary text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {tooltip}
        </span>
      )}
    </button>
  );
}
