/**
 * Model Filter Plugin
 * 
 * This plugin enhances the model selection with a search box that allows
 * fuzzy searching by model name or ID, with highlighted matching characters.
 */
import type { Context } from '@deepseek-ai/cordis'
import { ModelSelect } from './client/ModelSelect.js'

export interface ModelFilterConfig {}

export function apply(ctx: Context, _config: ModelFilterConfig) {
  ctx.provide('model-select-enhanced', ModelSelect)
}