import React from 'react';

interface FormattedMessageProps {
  text: string;
}

/**
 * Renders chat message text with basic formatting:
 * - **bold** or __bold__
 * - _italic_ or *italic* (single)
 * - Lines starting with "- " as bullet points
 * - Preserves line breaks
 */
export function FormattedMessage({ text }: FormattedMessageProps) {
  const lines = text.split('\n');

  return (
    <div className="whitespace-pre-wrap">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trimStart();
        const isBullet = trimmed.startsWith('- ');

        const content = isBullet ? trimmed.slice(2) : line;
        const formatted = formatInline(content);

        return (
          <React.Fragment key={lineIdx}>
            {lineIdx > 0 && !isBullet && !lines[lineIdx - 1]?.trimStart().startsWith('- ') && '\n'}
            {isBullet ? (
              <div className="flex items-start gap-1.5 ml-1">
                <span className="text-muted-foreground mt-[2px] flex-shrink-0">•</span>
                <span>{formatted}</span>
              </div>
            ) : (
              <>{formatted}{lineIdx < lines.length - 1 && !lines[lineIdx + 1]?.trimStart().startsWith('- ') ? '\n' : lineIdx < lines.length - 1 ? '' : ''}</>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function formatInline(text: string): React.ReactNode[] {
  // Process bold (**text**) and italic (_text_) patterns
  const parts: React.ReactNode[] = [];
  // Regex: **bold**, _italic_
  const regex = /(\*\*(.+?)\*\*)|(_(.+?)_)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // Bold
      parts.push(<strong key={match.index} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // Italic
      parts.push(<em key={match.index}>{match[4]}</em>);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
