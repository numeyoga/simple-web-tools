/** @import { Settings, WorkspaceData } from '../types.d.ts' */

// What a workspace holds before the person has put anything in it: no name, no template, no
// application, and the default tags (in the language of the interface).

import { emptySettings } from '../core/model.js';
import { defaultTags } from '../core/sample.js';
import { t } from './i18n.js';

/**
 * The settings of a workspace that holds none yet.
 * @returns {Settings}
 */
export function startingSettings() {
  return { ...emptySettings(), tags: defaultTags(t) };
}

/**
 * The data of an empty workspace: nothing but the default tags.
 * @returns {WorkspaceData}
 */
export function emptyWorkspaceData() {
  return { settings: startingSettings(), templates: [], apps: [] };
}
