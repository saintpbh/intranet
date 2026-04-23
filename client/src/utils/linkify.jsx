import React from 'react';

// Markdown-style links: [Link text](url) — allows optional whitespace between ] and (
const MD_REGEX = /\[([^\]]+)\]\s*\(([^)\s]+)\)/g;

// URLs: anything starting with http(s):// is always matched,
// plus bare domains with common TLDs
const URL_REGEX = /(https?:\/\/[^\s<>"'{}()\[\]]+|(?:www\.)[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s<>"'{}()\[\]]*)?)/gi;

// Trim trailing punctuation that likely isn't part of the URL
const trimTrailingPunctuation = (url) => url.replace(/[.,;:!?]+$/, '');

export const LinkifyText = ({ text }) => {
  if (!text) return null;
  
  const result = [];
  let keyIdx = 0;

  // Phase 1: Split by markdown links first
  const mdParts = text.split(MD_REGEX);

  for (let i = 0; i < mdParts.length; i++) {
    if (i % 3 === 0) {
      // Plain text segment — may contain bare URLs
      const plainText = mdParts[i];
      if (!plainText) continue;

      const urlParts = plainText.split(URL_REGEX);
      for (let j = 0; j < urlParts.length; j++) {
        const part = urlParts[j];
        if (!part) continue;

        if (URL_REGEX.test(part)) {
          // Reset lastIndex since we use /g flag
          URL_REGEX.lastIndex = 0;
          let href = trimTrailingPunctuation(part);
          const display = href;
          if (!/^https?:\/\//i.test(href)) {
            href = 'https://' + href;
          }
          result.push(
            <a 
              key={`url-${keyIdx++}`} 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                color: '#0070eb',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                WebkitTapHighlightColor: 'rgba(0,112,235,0.15)',
                padding: '2px 0',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {display}
            </a>
          );
        } else {
          result.push(<span key={`text-${keyIdx++}`}>{part}</span>);
        }
      }
      // Reset lastIndex
      URL_REGEX.lastIndex = 0;
    } else if (i % 3 === 1) {
      // Markdown link text
      const linkText = mdParts[i];
      const linkUrl = mdParts[i + 1];
      if (!linkUrl) continue;
      let href = linkUrl.trim();
      if (!/^https?:\/\//i.test(href)) {
        href = 'https://' + href;
      }
      result.push(
        <a 
          key={`md-${keyIdx++}`} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: '#0070eb',
            fontWeight: 600,
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            wordBreak: 'break-all',
            WebkitTapHighlightColor: 'rgba(0,112,235,0.15)',
            padding: '4px 0',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          🔗 {linkText}
        </a>
      );
    } else {
      // i % 3 === 2 — Markdown URL part, already consumed above
      continue;
    }
  }
  
  return <>{result}</>;
};
