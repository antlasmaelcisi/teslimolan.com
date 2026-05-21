import React, { useRef, useEffect } from 'react';

interface ContentEditableProps extends React.HTMLAttributes<HTMLDivElement> {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  currentColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
}

export const ContentEditable: React.FC<ContentEditableProps> = ({ 
  html, 
  onChange, 
  placeholder,
  currentColor,
  isBold,
  isItalic,
  isUnderline,
  className,
  onFocus,
  onBlur,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  onKeyDown,
  onPaste,
  ...props
}) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const enforceFormatting = () => {
    const selection = window.getSelection();
    if (selection && selection.isCollapsed) {
      if (currentColor !== undefined && currentColor !== '') {
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, currentColor);
        document.execCommand('styleWithCSS', false, 'false');
      }
      
      // Force formatting state to match sticky props
      if (isBold !== undefined && isBold !== document.queryCommandState('bold')) {
        document.execCommand('bold', false);
      }
      if (isItalic !== undefined && isItalic !== document.queryCommandState('italic')) {
        document.execCommand('italic', false);
      }
      if (isUnderline !== undefined && isUnderline !== document.queryCommandState('underline')) {
        document.execCommand('underline', false);
      }
    }
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // If we have sticky formatting or color, intercept keydown to enforce it for next characters
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const hasColor = currentColor !== undefined && currentColor !== '';
      
      e.preventDefault();
      
      let charHtml = e.key;
      if (e.key === ' ') charHtml = '&nbsp;';
      
      // 1. Apply active formatting
      if (isBold) charHtml = `<b>${charHtml}</b>`;
      if (isItalic) charHtml = `<i>${charHtml}</i>`;
      if (isUnderline) charHtml = `<u>${charHtml}</u>`;
      
      // 2. Identify if we are in a place that would normally inherit unwanted formatting (prevent the neighbors effect)
      let forceOffStyle = "";
      if (isBold === false && document.queryCommandState('bold')) forceOffStyle += "font-weight: 400 !important;";
      if (isItalic === false && document.queryCommandState('italic')) forceOffStyle += "font-style: normal !important;";
      if (isUnderline === false && document.queryCommandState('underline')) forceOffStyle += "text-decoration: none !important;";
      
      const finalColorStyle = hasColor ? `color: ${currentColor};` : "";
      
      if (forceOffStyle || hasColor) {
          document.execCommand('insertHTML', false, `<span style="${finalColorStyle} ${forceOffStyle}">${charHtml}</span>`);
      } else {
          document.execCommand('insertHTML', false, charHtml);
      }
      return;
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handlePasteInternal = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if (onPaste) onPaste(e);
  };

  useEffect(() => {
    if (contentEditableRef.current && html !== contentEditableRef.current.innerHTML && document.activeElement !== contentEditableRef.current) {
      contentEditableRef.current.innerHTML = html;
    }
  }, [html]);

  const htmlRef = useRef(html);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    htmlRef.current = html;
    onChangeRef.current = onChange;
  }, [html, onChange]);

  useEffect(() => {
    if (!contentEditableRef.current) return;

    const observer = new MutationObserver(() => {
      if (contentEditableRef.current && htmlRef.current !== contentEditableRef.current.innerHTML) {
        onChangeRef.current(contentEditableRef.current.innerHTML);
      }
    });

    observer.observe(contentEditableRef.current, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      {...props}
      ref={contentEditableRef}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className={`relative ${className} ${(!html || html === '<br>' || html === '<div><br></div>' || html === '&nbsp;' || html === '\u00A0') && placeholder ? 'content-editable-placeholder' : ''}`}
      data-placeholder={placeholder}
      onInput={(e) => {
        onChange(e.currentTarget.innerHTML);
        document.dispatchEvent(new Event('selectionchange'));
      }}
      onFocus={(e) => {
        if (onFocus) onFocus(e);
        enforceFormatting();
      }}
      onBlur={(e) => {
        onChange(e.currentTarget.innerHTML);
        if (onBlur) onBlur(e);
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseUp={(e) => {
        if (onMouseUp) onMouseUp(e);
        enforceFormatting();
      }}
      onKeyUp={(e) => {
        enforceFormatting();
      }}
      onKeyDown={handleKeyDownInternal}
      onPaste={handlePasteInternal}
    />
  );
};
