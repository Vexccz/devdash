import { useEffect, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github-dark.css';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function MarkdownMessage({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const html = (() => {
    try {
      const rendered = marked.parse(content, { async: false }) as string;
      return DOMPurify.sanitize(rendered, {
        ADD_ATTR: ['target', 'rel'],
        FORBID_TAGS: ['style', 'script'],
      });
    } catch {
      return content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  })();

  useEffect(() => {
    if (!ref.current) return;

    // Make links open externally
    ref.current.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.onclick = (e) => {
        e.preventDefault();
        void (window as any).devdash?.shell?.openExternal?.(href);
      };
    });

    // Attach copy buttons to code blocks + syntax highlight
    ref.current.querySelectorAll('pre code').forEach((codeEl) => {
      const el = codeEl as HTMLElement;
      if (el.dataset.highlighted === 'true') return;
      try {
        hljs.highlightElement(el);
        el.dataset.highlighted = 'true';
      } catch {
        /* skip broken highlight */
      }
    });

    ref.current.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.copy-btn')) return;
      const btn = document.createElement('button');
      btn.className =
        'copy-btn absolute right-1.5 top-1.5 rounded border border-dash-line bg-dash-panel/90 px-1.5 py-0.5 text-[9px] text-dash-mute hover:text-dash-text';
      btn.textContent = 'Copy';
      btn.onclick = async (e) => {
        e.preventDefault();
        const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = 'Copied';
          setTimeout(() => (btn.textContent = 'Copy'), 1200);
        } catch {
          btn.textContent = 'Error';
        }
      };
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className="markdown-body text-xs leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
