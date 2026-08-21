/**
 * Model Filter Plugin — Client entry.
 *
 * Registers the enhanced ModelSelect (with search) in the composer's
 * `conversation.input.model` slot, replacing the default occupant.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ModelSelectInjected } from './slots.js'
import { ModelSelect } from './ModelSelect.js'

export const inject = ['slots', 'sessions', 'modelDirectories']

export function apply(ctx: ClientContext): void {
  ctx.inject(['slots', 'modelDirectories'], (scope) => {
    const models = scope.modelDirectories
    const sessions = scope.sessions

    scope.slots.inject('conversation.input.model', () => scope.slots.register({
      name: 'conversation.input.model',
      priority: -1,
      locale: 'model',
      inject: (sessionId): ModelSelectInjected => {
        const directory = models.directoryFor(sessionId)
        const available = sessions.subagentAddress(sessionId) === undefined
        return {
          available,
          directory: directory.store,
          load: () => {
            if (available) directory.load().catch(() => { /* surfaced on the store */ })
          },
          select: (selection) => available
            ? directory.select(selection).then(() => true, () => false)
            : Promise.resolve(false),
        }
      },
    }, ModelSelect))
  })
}