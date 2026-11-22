// The Covenant component builders of Dashboard: the Anatomy of each component page of the skill, with
// its classes, roles and ARIA links. They come from `@simple-web-tools/dom/ui`, set up here
// with the app's class prefix (`fv`) and translator. The look and the behaviours come from
// `@simple-web-tools/covenant`; nothing here styles a component.

import { createUi } from '@simple-web-tools/dom/ui';
import { i18n } from '../i18n.js';

export * from './lib.js';

export const {
  Alert,
  Badge,
  Button,
  Checkbox,
  Combobox,
  Confirm,
  EmptyState,
  IconButton,
  Input,
  Kbd,
  Menu,
  Modal,
  Segmented,
  Select,
  Tag,
  Textarea,
  ToastHost,
} = createUi({ prefix: 'dsh', i18n });
