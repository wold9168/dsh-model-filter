/**
 * Model Filter Plugin — Host entry.
 *
 * Enhances the model selection dropdown with a search box.
 * The Host half is minimal; the Client half registers in the
 * `conversation.input.model` slot directly.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-model-filter'

export interface ModelFilterConfig {}

export function apply(_ctx: Context, _config: ModelFilterConfig) {
  // Slot registration and UI are handled by the Client half.
}

export default apply