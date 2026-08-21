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
        // A hero session (no workspace picked yet) must not mount the model
        // seat: loading the catalog here sends host RPCs and can raise a
        // composer block (routable === false) that interferes with the
        // workspace picker's connectWorkspace flow. Render null instead.
        const summary = sessions.list.getSnapshot().byId[sessionId]
        const hero = summary === undefined || summary.cwd === undefined || summary.cwd === ''
        if (hero) {
          return {
            available: false,
            directory: directory.store,
            load: () => { /* no-op: hero session has no model catalog */ },
            select: () => Promise.resolve(false),
          }
        }
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
