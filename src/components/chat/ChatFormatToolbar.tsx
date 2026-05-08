import { Bold, Italic, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useEffect } from 'react';

interface ChatFormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  value: string,
  prefix: string,
  suffix: string,
  onChange: (v: string) => void
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.substring(start, end);
  const before = value.substring(0, start);
  const after = value.substring(end);

  if (selected) {
    const newValue = `${before}${prefix}${selected}${suffix}${after}`;
    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  } else {
    const placeholder = prefix === '- ' ? 'list item' : 'text';
    const newValue = `${before}${prefix}${placeholder}${suffix}${after}`;
    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length);
    }, 0);
  }
}

export function ChatFormatToolbar({ textareaRef, value, onChange }: ChatFormatToolbarProps) {
  const handleBold = () => {
    if (!textareaRef.current) return;
    wrapSelection(textareaRef.current, value, '**', '**', onChange);
  };

  const handleItalic = () => {
    if (!textareaRef.current) return;
    wrapSelection(textareaRef.current, value, '_', '_', onChange);
  };

  const handleBullet = () => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);

    if (selected) {
      const lines = selected.split('\n');
      const bulleted = lines.map(line => {
        const trimmed = line.trimStart();
        return trimmed.startsWith('- ') ? line : `- ${trimmed}`;
      }).join('\n');
      const newValue = `${before}${bulleted}${after}`;
      onChange(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + bulleted.length);
      }, 0);
    } else {
      const needsNewline = before.length > 0 && !before.endsWith('\n');
      const prefix = needsNewline ? '\n- ' : '- ';
      const newValue = `${before}${prefix}${after}`;
      onChange(newValue);
      setTimeout(() => {
        textarea.focus();
        const cursorPos = start + prefix.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    }
  };

  // Keyboard shortcuts: Ctrl+B / Cmd+B for bold, Ctrl+I / Cmd+I for italic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleBold();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        handleItalic();
      }
    };

    textarea.addEventListener('keydown', handleKeyDown);
    return () => textarea.removeEventListener('keydown', handleKeyDown);
  }, [textareaRef, value, onChange]);

  const actions = [
    { icon: Bold, label: 'Bold', shortcut: '⌘B', onClick: handleBold },
    { icon: Italic, label: 'Italic', shortcut: '⌘I', onClick: handleItalic },
    { icon: List, label: 'Bullet list', shortcut: '', onClick: handleBullet },
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-1">
        {actions.map(({ icon: Icon, label, shortcut, onClick }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground active:scale-95 touch-manipulation sm:h-7 sm:w-7"
                onClick={onClick}
              >
                <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {label}{shortcut ? ` (${shortcut})` : ''}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
