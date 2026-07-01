import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

const ARTICLE_ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.txt,.rtf,.ppt,.pptx,.xls,.xlsx,.zip,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip';

function displayNameFromUrl(url) {
  if (!url) return 'Attached file';
  try {
    const path = new URL(url).pathname;
    const seg = path.split('/').pop() || 'Attached file';
    return decodeURIComponent(seg);
  } catch {
    const parts = String(url).split('/');
    return parts[parts.length - 1] || 'Attached file';
  }
}

function isEffectivelyEmptyHtml(html) {
  if (!html || !String(html).trim()) return true;
  const el = document.createElement('div');
  el.innerHTML = html;
  return !(el.textContent || '').trim();
}

/**
 * @param {{
 *   value: string;
 *   onChange: (html: string) => void;
 *   attachmentFile?: File | null;
 *   onAttachmentChange?: (file: File | null) => void;
 *   existingAttachmentUrl?: string | null;
 * }} props
 */
export default function ArticleBodyEditor({
  value = '',
  onChange,
  attachmentFile = null,
  onAttachmentChange,
  existingAttachmentUrl = null,
}) {
  const fileInputRef = useRef(null);
  const canAttach = typeof onAttachmentChange === 'function';
  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'article-tiptap-content',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const html = editor.getHTML();
    const v = value ?? '';
    if (isEffectivelyEmptyHtml(html) && isEffectivelyEmptyHtml(v)) return;
    if (html === v) return;
    editor.commands.setContent(v || '', { emitUpdate: false });
  }, [editor, value]);

  const btn = (active) => ({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 34,
      height: 34,
      padding: '0 8px',
      borderRadius: 6,
      border: '1px solid transparent',
      background: active ? 'rgba(var(--green-rgb), 0.12)' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--muted)',
      cursor: 'pointer',
      fontFamily: 'var(--font)',
    },
    onMouseEnter: (e) => {
      e.currentTarget.style.background = active ? 'rgba(var(--green-rgb), 0.18)' : 'rgba(255,255,255,0.06)';
    },
    onMouseLeave: (e) => {
      e.currentTarget.style.background = active ? 'rgba(var(--green-rgb), 0.12)' : 'transparent';
    },
  });

  const showPlaceholder = editor?.isEmpty;

  return (
    <div className="article-tiptap-editor">
      {editor && (
        <div
          className="article-tiptap-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <button
            {...btn(editor.isActive('bold'))}
            type="button"
            aria-label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <BoldIcon />
          </button>
          <button
            {...btn(editor.isActive('italic'))}
            type="button"
            aria-label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon />
          </button>
          <button
            {...btn(editor.isActive('bulletList'))}
            type="button"
            aria-label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <BulletIcon />
          </button>
          <button
            {...btn(editor.isActive('heading', { level: 2 }))}
            type="button"
            aria-label="Heading 2"
            title="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.02em' }}>H2</span>
          </button>
          {canAttach && (
            <>
              <span
                style={{
                  width: 1,
                  height: 22,
                  background: 'var(--border)',
                  margin: '0 4px',
                  flexShrink: 0,
                }}
                aria-hidden
              />
              <button
                {...btn(false)}
                type="button"
                aria-label="Attach file from computer"
                title="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                <AttachIcon />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ARTICLE_ATTACHMENT_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  onAttachmentChange(file);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>
      )}
      <div className="article-tiptap-body-wrap">
        <EditorContent editor={editor} />
        {showPlaceholder && (
          <span className="article-tiptap-placeholder">Write your article…</span>
        )}
      </div>
      {canAttach && (attachmentFile || existingAttachmentUrl) && (
        <div className="article-tiptap-attachment">
          {attachmentFile ? (
            <>
              <span className="article-tiptap-attachment-label" title={attachmentFile.name}>
                <AttachIcon />
                {attachmentFile.name}
              </span>
              <button
                type="button"
                className="article-tiptap-attachment-remove"
                onClick={() => onAttachmentChange(null)}
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <a
                href={existingAttachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="article-tiptap-attachment-link"
                title={displayNameFromUrl(existingAttachmentUrl)}
              >
                <AttachIcon />
                {displayNameFromUrl(existingAttachmentUrl)}
              </a>
              <button
                type="button"
                className="article-tiptap-attachment-replace"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace file
              </button>
            </>
          )}
        </div>
      )}
      {canAttach && !attachmentFile && !existingAttachmentUrl && (
        <p className="article-tiptap-attachment-hint">
          Optional: attach PDF, Word, Excel, PowerPoint, TXT, RTF, ZIP, or ODT (up to 100 MB).
        </p>
      )}
    </div>
  );
}

function BoldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5h6.5a3.5 3.5 0 012.45 5.95A3.75 3.75 0 0115.25 19H8V5.5zm2 7.8h4.1a1.6 1.6 0 100-3.2H10v3.2zm0 5.2h4.45a1.85 1.85 0 100-3.7H10v3.7z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10 5h7v2h-2.3l-3.2 10H14v2H7v-2h2.3l3.2-10H10V5z" />
    </svg>
  );
}

function BulletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 7h2v2H7V7zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm4-8h10v2H11V7zm0 4h10v2H11v-2zm0 4h10v2H11v-2z" />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.5 6v11.25a4.25 4.25 0 01-8.5 0V7.25a2.75 2.75 0 015.5 0v8.5a1.25 1.25 0 01-2.5 0V8h-1.5v7.75a2.75 2.75 0 105.5 0V7.25a4.25 4.25 0 00-8.5 0v9.75h1.5V7.25a2.75 2.75 0 015.5 0v8.5a4.25 4.25 0 11-8.5 0V6.5h-1.5v9.25a5.75 5.75 0 1011.5 0V7.25a5.75 5.75 0 10-11.5 0v10h1.5V7.25z" />
    </svg>
  );
}

