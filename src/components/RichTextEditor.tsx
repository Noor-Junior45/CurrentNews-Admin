import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { cleanImageUrl } from '../utils/imageUrl';

export interface RichTextEditorHandle {
  insertPhoto: (url: string) => void;
  insertFigure: (figNumOrUrl: number | string) => void;
  insertHtmlAtCursor: (html: string) => void;
  focus: () => void;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  availablePhotoCount?: number;
  availablePhotos?: string[];
}

const QuillComponent = ReactQuill as any;

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, placeholder, availablePhotos = [] },
  ref
) {
  const quillRef = useRef<any>(null);

  // Formats for rich text editing
  const formats = [
    'header',
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'code-block',
    'list',
    'indent',
    'align',
    'color',
    'background',
    'link',
    'image',
  ];

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],          
      [{ 'align': [] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['blockquote', 'code-block', 'link', 'image'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    }
  };

  const insertPhotoAtCursor = (rawUrl: string) => {
    if (!rawUrl || !rawUrl.trim()) return;
    const cleanUrl = cleanImageUrl(rawUrl.trim());
    const editor = quillRef.current?.getEditor();
    
    // Paste direct visual image block with responsive styling and immediate text line below
    const htmlBlock = `<p><img src="${cleanUrl}" alt="Article Photo" class="article-body-photo" /></p><p><br></p>`;

    if (editor) {
      editor.focus();
      const selection = editor.getSelection();
      const index = selection ? selection.index : editor.getLength();

      editor.clipboard.dangerouslyPasteHTML(index, htmlBlock, 'user');

      // Place typing cursor directly below the image on the fresh new line
      setTimeout(() => {
        try {
          editor.focus();
          const nextIndex = Math.min(index + 2, editor.getLength());
          editor.setSelection(nextIndex, 0, 'user');
        } catch (e) {}
      }, 60);
    } else {
      const currentVal = value || '';
      onChange(currentVal + htmlBlock);
    }
  };

  const insertHtmlAtCursor = (html: string) => {
    const editor = quillRef.current?.getEditor();
    if (editor) {
      editor.focus();
      const selection = editor.getSelection();
      const index = selection ? selection.index : editor.getLength();
      editor.clipboard.dangerouslyPasteHTML(index, html, 'user');
      setTimeout(() => {
        editor.focus();
        editor.setSelection(editor.getLength() - 1, 0, 'user');
      }, 50);
    } else {
      const currentVal = value || '';
      onChange(currentVal + html);
    }
  };

  useImperativeHandle(ref, () => ({
    insertPhoto: (url: string) => {
      insertPhotoAtCursor(url);
    },
    insertFigure: (figNumOrUrl: number | string) => {
      if (typeof figNumOrUrl === 'string' && (figNumOrUrl.startsWith('http') || figNumOrUrl.startsWith('data:') || figNumOrUrl.startsWith('blob:'))) {
        insertPhotoAtCursor(figNumOrUrl);
        return;
      }
      const num = typeof figNumOrUrl === 'number' ? figNumOrUrl : parseInt(String(figNumOrUrl).replace(/\D/g, ''), 10) || 1;
      const targetPhoto = availablePhotos?.[num - 1];
      if (targetPhoto) {
        insertPhotoAtCursor(targetPhoto);
      }
    },
    insertHtmlAtCursor: (html: string) => {
      insertHtmlAtCursor(html);
    },
    focus: () => {
      quillRef.current?.getEditor()?.focus();
    }
  }));

  const handleFocusEditor = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Do not interfere with toolbar button or picker clicks
    if (target.closest('.ql-toolbar')) return;

    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    if (!editor.hasFocus()) {
      editor.focus();
    }

    const editorEl = editor.root;
    if (editorEl) {
      const length = editor.getLength();
      const lastChild = editorEl.lastElementChild;
      if (lastChild) {
        const clientY = 'touches' in e && e.touches.length > 0 
          ? e.touches[0].clientY 
          : ('clientY' in e ? (e as React.MouseEvent).clientY : 0);
        const lastChildRect = lastChild.getBoundingClientRect();
        if (clientY > lastChildRect.bottom || target === editorEl || target.classList.contains('ql-container') || target.classList.contains('quill')) {
          editor.setSelection(Math.max(0, length - 1), 0, 'user');
        }
      } else {
        editor.setSelection(0, 0, 'user');
      }
    }
  };

  return (
    <div className="w-full flex flex-col" id="quill-editor-wrapper">
      {/* Main Editor Component */}
      <div 
        className="bg-white dark:bg-slate-950 cursor-text min-h-[280px]"
        onClick={handleFocusEditor}
        onTouchEnd={handleFocusEditor}
      >
        <QuillComponent
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder || "Compose your news post story here..."}
        />
      </div>

      {/* Editor Status Indicator */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 font-mono rounded-b-lg">
        <span>Manuscript Editor</span>
        <span>HTML Active</span>
      </div>
    </div>
  );
});

export default RichTextEditor;

