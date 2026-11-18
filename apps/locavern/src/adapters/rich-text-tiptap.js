/** @import { Content } from '@tiptap/core' */
/** @import { RichTextDoc } from '../types.d.ts' */

import { Editor, Node } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import BulletList from '@tiptap/extension-bullet-list';
import Code from '@tiptap/extension-code';
import Document from '@tiptap/extension-document';
import Heading from '@tiptap/extension-heading';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import ListItem from '@tiptap/extension-list-item';
import OrderedList from '@tiptap/extension-ordered-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Text from '@tiptap/extension-text';
import { UndoRedo } from '@tiptap/extensions';
import { EMPTY_RICH_DOC, sanitizeLinkHref, sanitizeRichTextDoc } from '../core/model.js';
import { initTooltips, setTooltip } from './dom/tooltip.js';

/**
 * Create a custom Tiptap Node for local-only images referenced by IndexedDB assetId.
 * Remote image URLs (http/https) are never parsed or rendered.
 * @param {(assetId: string) => Promise<string | null>} resolveAssetUrl
 */
function createLocalImageExtension(resolveAssetUrl) {
  return Node.create({
    name: 'localImage',
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
      return {
        assetId: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-asset-id'),
          renderHTML: (attrs) => (attrs.assetId ? { 'data-asset-id': String(attrs.assetId) } : {}),
        },
        alt: {
          default: '',
          parseHTML: (el) => el.getAttribute('alt') ?? '',
          renderHTML: (attrs) => ({ alt: String(attrs.alt ?? '') }),
        },
      };
    },

    parseHTML() {
      return [{ tag: 'img[data-asset-id]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ['img', HTMLAttributes];
    },

    addNodeView() {
      return ({ node }) => {
        const figure = document.createElement('figure');
        figure.className = 'lc-local-image';
        const img = document.createElement('img');
        const assetId = typeof node.attrs.assetId === 'string' ? node.attrs.assetId : '';
        img.alt =
          typeof node.attrs.alt === 'string' && node.attrs.alt ? node.attrs.alt : 'Image locale';
        if (assetId) {
          img.dataset.assetId = assetId;
          void resolveAssetUrl(assetId).then((url) => {
            if (url) {
              img.src = url;
            }
          });
        }
        figure.append(img);
        return { dom: figure };
      };
    },
  });
}

/**
 * Create a toolbar button with Phosphor icon and aria-pressed support.
 * @param {{ icon: string; label: string; toggle?: boolean; onClick: () => void }} opts
 * @returns {HTMLButtonElement}
 */
function makeToolbarButton({ icon, label, toggle = false, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cv-btn cv-btn--ghost cv-btn--sm';
  btn.setAttribute('aria-label', label);
  setTooltip(btn, label);
  if (toggle) {
    btn.setAttribute('aria-pressed', 'false');
  }
  const ic = document.createElement('i');
  ic.className = `ph ${icon} cv-icon`;
  ic.setAttribute('aria-hidden', 'true');
  btn.append(ic);
  btn.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Mount a headless Tiptap editor with Covenant toolbar and local image protection.
 * @param {{
 *   container: HTMLElement;
 *   initialDoc: RichTextDoc;
 *   editable: boolean;
 *   ariaLabel: string;
 *   resolveAssetUrl: (assetId: string) => Promise<string | null>;
 *   onUploadImage: (file: File) => Promise<{ assetId: string; alt: string } | null>;
 *   onBlockedRemoteImage?: () => void;
 *   onRejectedLink?: () => void;
 *   onChange: (doc: RichTextDoc) => void;
 * }} opts
 */
export function mountRichTextEditor({
  container,
  initialDoc,
  editable,
  ariaLabel,
  resolveAssetUrl,
  onUploadImage,
  onBlockedRemoteImage,
  onRejectedLink,
  onChange,
}) {
  const uid = `lc-rt-${Math.random().toString(36).slice(2, 8)}`;

  const root = document.createElement('div');
  root.className = 'lc-editor';

  const toolbar = document.createElement('div');
  toolbar.className = 'lc-editor__toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Mise en forme du texte');

  const linkBar = document.createElement('div');
  linkBar.className = 'lc-editor__toolbar';
  linkBar.hidden = true;

  const linkLabel = document.createElement('label');
  linkLabel.className = 'cv-label';
  linkLabel.htmlFor = `${uid}-link-input`;
  linkLabel.textContent = 'Lien (https://)';

  const linkInput = document.createElement('input');
  linkInput.id = `${uid}-link-input`;
  linkInput.type = 'url';
  linkInput.className = 'cv-input';
  linkInput.placeholder = 'https://exemple.org';
  linkInput.style.flex = '1';
  linkInput.style.minWidth = 'min(100%, 10rem)';

  const linkApply = document.createElement('button');
  linkApply.type = 'button';
  linkApply.className = 'cv-btn cv-btn--primary cv-btn--sm';
  linkApply.textContent = 'Appliquer';

  const linkCancel = document.createElement('button');
  linkCancel.type = 'button';
  linkCancel.className = 'cv-btn cv-btn--sm';
  linkCancel.textContent = 'Annuler';

  linkBar.append(linkLabel, linkInput, linkApply, linkCancel);

  const surface = document.createElement('div');
  surface.className = 'lc-editor__surface';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  fileInput.className = 'lc-file-input-hidden';
  fileInput.setAttribute('aria-hidden', 'true');
  fileInput.tabIndex = -1;

  if (editable) {
    root.append(toolbar, linkBar, surface, fileInput);
  } else {
    root.append(surface);
  }
  container.replaceChildren(root);
  if (editable) {
    initTooltips(toolbar);
  }

  const initialContent = /** @type {Content} */ (
    /** @type {unknown} */ (sanitizeRichTextDoc(initialDoc ?? EMPTY_RICH_DOC))
  );

  /** @type {Editor} */
  const editor = new Editor({
    element: surface,
    editable,
    content: initialContent,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Code,
      Strike,
      Heading.configure({ levels: [1, 2, 3] }),
      BulletList,
      OrderedList,
      ListItem,
      TaskList,
      TaskItem.configure({ nested: true }),
      UndoRedo,
      Link.configure({
        openOnClick: false,
        autolink: false,
        protocols: ['https', 'mailto'],
        isAllowedUri: (url) => sanitizeLinkHref(url) !== null,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      createLocalImageExtension(resolveAssetUrl),
    ],
    editorProps: {
      attributes: editable
        ? {
            role: 'textbox',
            'aria-multiline': 'true',
            'aria-label': ariaLabel,
          }
        : {
            role: 'region',
            'aria-label': ariaLabel,
          },
      handlePaste(_view, event) {
        if (!editable) return false;
        const dt = event.clipboardData;
        if (!dt) return false;

        const files = [...dt.files].filter((f) => f.type.startsWith('image/'));
        if (files.length > 0) {
          event.preventDefault();
          void (async () => {
            for (const file of files) {
              const uploaded = await onUploadImage(file);
              if (uploaded) {
                editor
                  .chain()
                  .focus()
                  .insertContent({
                    type: 'localImage',
                    attrs: { assetId: uploaded.assetId, alt: uploaded.alt },
                  })
                  .run();
              }
            }
          })();
          return true;
        }

        const html = dt.getData('text/html');
        const plain = dt.getData('text/plain').trim();
        const hasRemoteHtmlImg =
          /<img\b[^>]*\bsrc\s*=\s*["']?\s*(https?:)?\/\//i.test(html) ||
          /<img\b[^>]*\bsrc\s*=\s*["']?\s*data:/i.test(html);
        const isRemoteImageUrl = /^https?:\/\/\S+\.(png|jpe?g|webp|gif|svg)(\?\S*)?$/i.test(plain);

        if (hasRemoteHtmlImg || isRemoteImageUrl) {
          onBlockedRemoteImage?.();
          if (isRemoteImageUrl) {
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
      handleDrop(_view, event) {
        if (!editable) return false;
        const dt = event.dataTransfer;
        if (!dt) return false;
        const files = [...dt.files].filter((f) => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        void (async () => {
          for (const file of files) {
            const uploaded = await onUploadImage(file);
            if (uploaded) {
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'localImage',
                  attrs: { assetId: uploaded.assetId, alt: uploaded.alt },
                })
                .run();
            }
          }
        })();
        return true;
      },
    },
    onUpdate({ editor: ed }) {
      const clean = sanitizeRichTextDoc(ed.getJSON());
      onChange(clean);
    },
  });

  const btnBold = makeToolbarButton({
    icon: 'ph-text-b',
    label: 'Gras',
    toggle: true,
    onClick: () => editor.chain().focus().toggleBold().run(),
  });
  const btnItalic = makeToolbarButton({
    icon: 'ph-text-italic',
    label: 'Italique',
    toggle: true,
    onClick: () => editor.chain().focus().toggleItalic().run(),
  });
  const btnStrike = makeToolbarButton({
    icon: 'ph-text-strikethrough',
    label: 'Barré',
    toggle: true,
    onClick: () => editor.chain().focus().toggleStrike().run(),
  });
  const btnCode = makeToolbarButton({
    icon: 'ph-code',
    label: 'Code en ligne',
    toggle: true,
    onClick: () => editor.chain().focus().toggleCode().run(),
  });
  const btnHeading1 = makeToolbarButton({
    icon: 'ph-text-h-one',
    label: 'Titre 1',
    toggle: true,
    onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  });
  const btnHeading2 = makeToolbarButton({
    icon: 'ph-text-h-two',
    label: 'Titre 2',
    toggle: true,
    onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  });
  const btnHeading3 = makeToolbarButton({
    icon: 'ph-text-h-three',
    label: 'Titre 3',
    toggle: true,
    onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  });
  const btnBullet = makeToolbarButton({
    icon: 'ph-list-bullets',
    label: 'Liste à puces',
    toggle: true,
    onClick: () => editor.chain().focus().toggleBulletList().run(),
  });
  const btnOrdered = makeToolbarButton({
    icon: 'ph-list-numbers',
    label: 'Liste numérotée',
    toggle: true,
    onClick: () => editor.chain().focus().toggleOrderedList().run(),
  });
  const btnTaskList = makeToolbarButton({
    icon: 'ph-check-square',
    label: 'Liste de contrôle',
    toggle: true,
    onClick: () => editor.chain().focus().toggleTaskList().run(),
  });
  const btnLink = makeToolbarButton({
    icon: 'ph-link',
    label: 'Lien',
    toggle: true,
    onClick: () => {
      const currentHref = editor.getAttributes('link').href;
      linkInput.value = typeof currentHref === 'string' ? currentHref : '';
      linkBar.hidden = !linkBar.hidden;
      if (!linkBar.hidden) {
        linkInput.focus();
      }
    },
  });
  const btnImage = makeToolbarButton({
    icon: 'ph-image',
    label: 'Insérer une image locale',
    onClick: () => fileInput.click(),
  });

  toolbar.append(
    btnBold,
    btnItalic,
    btnStrike,
    btnCode,
    btnHeading1,
    btnHeading2,
    btnHeading3,
    btnBullet,
    btnOrdered,
    btnTaskList,
    btnLink,
    btnImage,
  );

  function syncToolbarState() {
    btnBold.setAttribute('aria-pressed', String(editor.isActive('bold')));
    btnItalic.setAttribute('aria-pressed', String(editor.isActive('italic')));
    btnStrike.setAttribute('aria-pressed', String(editor.isActive('strike')));
    btnCode.setAttribute('aria-pressed', String(editor.isActive('code')));
    btnHeading1.setAttribute('aria-pressed', String(editor.isActive('heading', { level: 1 })));
    btnHeading2.setAttribute('aria-pressed', String(editor.isActive('heading', { level: 2 })));
    btnHeading3.setAttribute('aria-pressed', String(editor.isActive('heading', { level: 3 })));
    btnBullet.setAttribute('aria-pressed', String(editor.isActive('bulletList')));
    btnOrdered.setAttribute('aria-pressed', String(editor.isActive('orderedList')));
    btnTaskList.setAttribute('aria-pressed', String(editor.isActive('taskList')));
    btnLink.setAttribute('aria-pressed', String(editor.isActive('link')));
  }

  editor.on('selectionUpdate', syncToolbarState);
  editor.on('transaction', syncToolbarState);
  syncToolbarState();

  linkApply.addEventListener('click', () => {
    const raw = linkInput.value.trim();
    if (!raw) {
      editor.chain().focus().unsetLink().run();
      linkBar.hidden = true;
      return;
    }
    const safeHref = sanitizeLinkHref(raw);
    if (!safeHref) {
      onRejectedLink?.();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: safeHref, target: '_blank', rel: 'noopener noreferrer' })
      .run();
    linkBar.hidden = true;
  });

  linkCancel.addEventListener('click', () => {
    linkBar.hidden = true;
    editor.commands.focus();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    void (async () => {
      const uploaded = await onUploadImage(file);
      if (uploaded) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: 'localImage',
            attrs: { assetId: uploaded.assetId, alt: uploaded.alt },
          })
          .run();
      }
    })();
  });

  return {
    getDoc() {
      return sanitizeRichTextDoc(editor.getJSON());
    },
    setDoc(/** @type {RichTextDoc} */ doc) {
      const nextContent = /** @type {Content} */ (
        /** @type {unknown} */ (sanitizeRichTextDoc(doc ?? EMPTY_RICH_DOC))
      );
      editor.commands.setContent(nextContent, { emitUpdate: false });
      syncToolbarState();
    },
    setEditable(/** @type {boolean} */ nextEditable) {
      editor.setEditable(nextEditable);
      toolbar.hidden = !nextEditable;
      if (!nextEditable) linkBar.hidden = true;
    },
    destroy() {
      editor.destroy();
    },
  };
}
