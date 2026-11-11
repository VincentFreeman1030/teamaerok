'use client';

import React from 'react';
import { APP_CONFIG } from '../constants';
import { AlertTriangle } from 'lucide-react';

interface Props {
  text: string;
  className?: string;
  showNotice?: boolean;
}

export const CautionHighlightedText: React.FC<Props> = ({
  text,
  className = '',
  showNotice = true,
}) => {
  if (!text) return null;

  const phrases = APP_CONFIG.cautionPhrases;
  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);
  const hasCaution = phrases.some((p) => text.includes(p));

  return (
    <div className="space-y-2">
      <p className={` leading-relaxed whitespace-pre-wrap ${className}`}>
        {parts.map((part, idx) => {
          if (phrases.includes(part)) {
            return (
              <span
                key={idx}
                className="underline decoration-wavy decoration-rose-500 decoration-2 bg-rose-50 text-rose-900 px-1 rounded font-medium"
                title="주의 표현: 사실과 행동으로 바꿔 써 보세요"
              >
                {part}
              </span>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>
      {showNotice && hasCaution && (
        <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50/90 border border-rose-200 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>
            주의 표현(<strong>{phrases.filter((p) => text.includes(p)).join(', ')}</strong>)이 들어 있습니다.{' '}
            <strong className="underline">사실과 행동으로 바꿔 써 보세요.</strong>
          </span>
        </div>
      )}
    </div>
  );
};
