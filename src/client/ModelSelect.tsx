/**
 * Enhanced ModelSelect: the composer's named model seat (`conversation.input.model`)
 * with search functionality for fuzzy searching models by name or ID.
 */
import {
  useEffect, useId, useMemo, useRef, useState, useSyncExternalStore,
  type KeyboardEvent, type FocusEvent, type ChangeEvent,
} from 'react'
import clsx from 'clsx'
import type { ModelReasoningEffort, ModelSelection, ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconCheckOutline16, IconChevronDownOutline14, IconChevronRightOutline14,
  IconWarningOutline16, Toast, IconSearchOutline16, Input,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelSelectInjected } from './slots.ts'
import { zh, en, type ModelFilterKey } from './locales.ts'
import css from './ModelSelect.module.css'

/** Which pane the dropdown shows: the two-level root or one drilled-in list. */
type Pane = 'root' | 'model' | 'effort'

/** One dynamic effort row; undefined means preserve the provider default. */
interface EffortChoice {
  key: string
  effort: string | undefined
  label: string
  description?: string
}

/** Extended locale type that includes model-filter keys. */
type ExtendedLocale = PropsLocale<'model'> & {
  (key: ModelFilterKey): string
  (key: ModelFilterKey, params: Record<string, string | number>): string
}

/**
 * Utility to highlight matching characters in a string.
 * Returns an array of { text: string; highlight: boolean } segments.
 */
function highlightMatches(text: string, query: string): Array<{ text: string; highlight: boolean }> {
  if (!query || !text) return [{ text, highlight: false }]

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const segments: Array<{ text: string; highlight: boolean }> = []

  let textIndex = 0
  let queryIndex = 0
  let segmentStart = 0

  while (textIndex < text.length && queryIndex < lowerQuery.length) {
    if (lowerText[textIndex] === lowerQuery[queryIndex]) {
      // Add preceding non-matching text since the last segment boundary
      if (textIndex > segmentStart) {
        segments.push({ text: text.slice(segmentStart, textIndex), highlight: false })
      }
      // Group consecutive matching characters into ONE highlighted segment
      // so the background is a contiguous block (no per-character gaps).
      const matchStart = textIndex
      while (textIndex < text.length && queryIndex < lowerQuery.length &&
             lowerText[textIndex] === lowerQuery[queryIndex]) {
        textIndex++
        queryIndex++
      }
      segments.push({ text: text.slice(matchStart, textIndex), highlight: true })
      segmentStart = textIndex
    } else {
      textIndex++
    }
  }

  // Add remaining text after the last match
  if (segmentStart < text.length) {
    segments.push({ text: text.slice(segmentStart), highlight: false })
  }

  // If no matches found, return original text
  if (segments.length === 0 || !segments.some(s => s.highlight)) {
    return [{ text, highlight: false }]
  }

  return segments
}

/**
 * Render highlighted text segments.
 */
function HighlightedText({ segments }: { segments: Array<{ text: string; highlight: boolean }> }) {
  return (
    <>
      {segments.map((segment, index) => (
        <span key={index} className={segment.highlight ? css.highlight : ''}>
          {segment.text}
        </span>
      ))}
    </>
  )
}

/**
 * Filter models by fuzzy search query against provider name/id, model name, and model id.
 */
function filterModels(groups: readonly ModelProviderGroup[], query: string): ModelProviderGroup[] {
  if (!query) return [...groups]

  const lowerQuery = query.toLowerCase()

  return groups
    .map(group => {
      // A provider/group name match shows all its models.
      const groupMatches = group.name.toLowerCase().includes(lowerQuery) ||
        group.id.toLowerCase().includes(lowerQuery)
      const filteredModels = groupMatches
        ? group.models
        : group.models.filter(model =>
            model.name.toLowerCase().includes(lowerQuery) ||
            model.id.toLowerCase().includes(lowerQuery)
          )
      if (filteredModels.length === 0) return null
      return { ...group, models: filteredModels }
    })
    .filter((group): group is ModelProviderGroup => group !== null)
}

/**
 * Render the composer model seat with search.
 * @param props - owner share (locked) + injected face (shared directory store/verbs) + the standard locale seat.
 * @returns the trigger and, while open, the two-level menu with search.
 */
export function ModelSelect(
  { locked, available, directory, load, select, t }:
  ModelSelectInjected & { locked: boolean } & { t: ExtendedLocale },
) {
  const state = useSyncExternalStore(
    fn => directory.subscribe(fn),
    () => directory.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>('root')
  const [searchQuery, setSearchQuery] = useState('')
  // The in-menu error strip serves catalog loads (its Retry re-runs the
  // load); a rejected SELECTION announces through the transient toast
  // instead, so the strip renders only while the latest failure-capable
  // action was a load.
  const lastActionRef = useRef<'load' | 'select'>('load')
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const toastSeq = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()

  const choices = useMemo(() => state.groups.flatMap(group =>
    group.models.map(model => ({
      group,
      model,
      selection: {
        provider: group.id,
        model: model.id,
        ...model.reasoning?.defaultEffort === undefined
          ? {}
          : { reasoningEffort: model.reasoning.defaultEffort },
      } satisfies ModelSelection,
    }))), [state.groups])
  const selectedIndex = state.current === null
    ? -1
    : choices.findIndex(c => c.selection.provider === state.current?.provider && c.selection.model === state.current.model)
  const currentChoice = choices[selectedIndex]
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortLabel = reasoning === undefined
    ? undefined
    : effectiveEffort === undefined
      ? t('effort.providerDefault')
      : reasoning.efforts.find(level => level.id === effectiveEffort)?.name ?? effectiveEffort
  const effortChoices = useMemo<readonly EffortChoice[]>(() => reasoning === undefined
    ? []
    : [
      ...reasoning.defaultEffort === undefined
        ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
        : [],
      ...reasoning.efforts.map((effort: ModelReasoningEffort) => ({
        key: `effort:${effort.id}`,
        effort: effort.id,
        label: effort.name,
        ...effort.description === undefined ? {} : { description: effort.description },
      })),
    ], [reasoning, t])
  const busy = state.status === 'selecting'

  const filteredGroups = useMemo(() => filterModels(state.groups, searchQuery), [state.groups, searchQuery])
  const hasSearchResults = searchQuery && filteredGroups.length > 0
  const noResults = searchQuery && filteredGroups.length === 0

  const reload = (): void => {
    lastActionRef.current = 'load'
    load()
  }

  // Mount-time load resolves the trigger label; every open refreshes.
  useEffect(() => {
    if (available) {
      lastActionRef.current = 'load'
      load()
    }
  }, [available, load])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open])

  // Focus search input when model pane opens
  useEffect(() => {
    if (pane === 'model' && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [pane])

  // Clear search when closing or switching panes
  useEffect(() => {
    if (pane !== 'model') {
      setSearchQuery('')
    }
  }, [pane])

  if (!available) return null

  const show = (): void => {
    setPane('root')
    setOpen(true)
    setSearchQuery('')
    reload()
  }

  const close = (restoreFocus = false): void => {
    setOpen(false)
    setPane('root')
    setSearchQuery('')
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  const moveFocus = (offset: number): void => {
    const items = itemRefs.current.filter(item => item !== null)
    if (items.length === 0) return
    const active = items.findIndex(item => item === document.activeElement)
    const next = (Math.max(active, 0) + offset + items.length) % items.length
    items[next]?.focus()
  }

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      // Escape backs out of a drilled pane first, then closes.
      if (pane !== 'root') setPane('root')
      else close(true)
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
    }
  }

  const onSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(event.target.value)
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return
    close()
  }

  const settleSelection = (accepted: boolean): void => {
    if (accepted) {
      if (rootRef.current !== null) close(true)
      return
    }
    const message = directory.getSnapshot().error
    if (message !== null) {
      toastSeq.current += 1
      setToast({ seq: toastSeq.current, text: t('error.action', { message }) })
    }
  }

  const choose = (selection: ModelSelection): void => {
    if (state.current?.provider === selection.provider && state.current.model === selection.model) {
      close(true)
      return
    }
    lastActionRef.current = 'select'
    void select(selection).then(settleSelection)
  }

  const chooseEffort = (effort: string | undefined): void => {
    if (state.current === null) return
    if (effectiveEffort === effort) {
      close(true)
      return
    }
    const selection: ModelSelection = {
      provider: state.current.provider,
      model: state.current.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    }
    lastActionRef.current = 'select'
    void select(selection).then(settleSelection)
  }

  const modelLabel = currentChoice?.model.name ?? t('trigger.fallback')
  const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`
  const triggerAria = currentChoice === undefined
    ? t('trigger.selectAria')
    : effortLabel === undefined
      ? t('trigger.aria', { model: modelLabel })
      : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel })
  itemRefs.current = []
  let itemIndex = 0
  const itemRef = () => {
    const at = itemIndex++
    return (node: HTMLButtonElement | null) => { itemRefs.current[at] = node }
  }

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onRootKeyDown} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={triggerLabel}
        disabled={locked}
        onClick={() => {
          if (open) {
            close()
          } else {
            show()
          }
        }}
      >
        <span className={css.triggerLabel}>{modelLabel}</span>
        {effortLabel !== undefined && <span className={css.triggerEffort}>{effortLabel}</span>}
        <IconChevronDownOutline14 className={clsx(css.chevron, open && css.chevronOpen)} />
      </button>

      {open && (
        <div
          id={`${id}-menu`}
          className={css.menu}
          role="menu"
          aria-label={t('menu.aria')}
          aria-busy={state.status === 'loading' || busy}
        >
          {pane === 'root' && (
            <>
              <button ref={itemRef()} type="button" role="menuitem" className={css.cell} onClick={() => { setPane('model') }}>
                <span className={css.cellLabel}>{t('menu.model')}</span>
                <span className={css.cellValue}>{modelLabel}</span>
                <IconChevronRightOutline14 className={css.cellChevron} />
              </button>
              {reasoning !== undefined && (
                <button ref={itemRef()} type="button" role="menuitem" className={css.cell} onClick={() => { setPane('effort') }}>
                  <span className={css.cellLabel}>{t('menu.effort')}</span>
                  <span className={css.cellValue}>{effortLabel}</span>
                  <IconChevronRightOutline14 className={css.cellChevron} />
                </button>
              )}
            </>
          )}

          {pane === 'model' && (
            <>
              <div className={css.searchWrapper}>
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder={t('search.placeholder')}
                  value={searchQuery}
                  onChange={onSearchChange}
                  className={css.searchInput}
                  aria-label={t('search.ariaLabel')}
                />
                <IconSearchOutline16 className={css.searchIcon} />
              </div>
              {state.status === 'loading' && (
                <div className={css.status}>{t('status.loading')}</div>
              )}
              {state.error !== null && lastActionRef.current === 'load' && (
                <div className={css.error}>
                  <span>{t('error.action', { message: state.error })}</span>
                  <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
                </div>
              )}
              {state.failures.map(failure => (
                <div className={css.warning} key={failure.id}>
                  <span>{t('warning.groupLoad', { name: failure.name, message: failure.message })}</span>
                  <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
                </div>
              ))}
              {noResults && (
                <div className={css.empty}>{t('empty.search', { query: searchQuery })}</div>
              )}
              {(hasSearchResults || (!searchQuery && state.status === 'ready')) && (
                <div className={clsx(css.groups, 'scrollable')}>
                  {filteredGroups.map((group) => {
                    const headingId = `${id}-${group.id}`
                    return (
                      <section role="group" aria-labelledby={headingId} className={css.group} key={group.id}>
                        <div className={css.groupTitle} id={headingId}>
                          <HighlightedText segments={highlightMatches(group.name, searchQuery)} />
                        </div>
                        {group.models.map((model) => {
                          const selected = state.current?.provider === group.id && state.current.model === model.id
                          const nameSegments = highlightMatches(model.name, searchQuery)
                          const idSegments = highlightMatches(model.id, searchQuery)
                          const matchedById = searchQuery && model.id.toLowerCase().includes(searchQuery.toLowerCase()) && !model.name.toLowerCase().includes(searchQuery.toLowerCase())
                          return (
                            <button
                              ref={itemRef()}
                              type="button"
                              role="menuitemradio"
                              aria-checked={selected}
                              className={clsx(css.option, selected && css.selected)}
                              key={model.id}
                              title={model.name}
                              disabled={busy}
                              onClick={() => { choose({ provider: group.id, model: model.id }) }}
                            >
                              <span className={css.optionCopy}>
                                <span className={css.modelName}>
                                  <HighlightedText segments={nameSegments} />
                                </span>
                                {model.description !== undefined && (
                                  <span className={css.description}>{model.description}</span>
                                )}
                                {matchedById && (
                                  <span className={css.modelId}>
                                    <HighlightedText segments={idSegments} />
                                  </span>
                                )}
                              </span>
                              <span className={css.check}>
                                {selected ? <IconCheckOutline16 /> : null}
                              </span>
                            </button>
                          )
                        })}
                      </section>
                    )
                  })}
                </div>
              )}
              {state.status === 'ready' && choices.length === 0 && !searchQuery && (
                <div className={css.empty}>{t('empty.models')}</div>
              )}
            </>
          )}

          {pane === 'effort' && (
            <>
              {state.error !== null && lastActionRef.current === 'load' && (
                <div className={css.error}>
                  <span>{t('error.action', { message: state.error })}</span>
                  <button type="button" className={css.retry} onClick={reload}>{t('action.reload')}</button>
                </div>
              )}
              {effortChoices.length === 0
                ? <div className={css.empty}>{t('empty.efforts')}</div>
                : effortChoices.map(level => (
                  <button
                    ref={itemRef()}
                    type="button"
                    role="menuitemradio"
                    aria-checked={effectiveEffort === level.effort}
                    className={clsx(css.option, effectiveEffort === level.effort && css.selected)}
                    key={level.key}
                    disabled={busy}
                    onClick={() => { chooseEffort(level.effort) }}
                  >
                    <span className={css.optionCopy}>
                      <span className={css.modelName}>{level.label}</span>
                      {level.description !== undefined && (
                        <span className={css.description}>{level.description}</span>
                      )}
                    </span>
                    <span className={css.check}>
                      {effectiveEffort === level.effort ? <IconCheckOutline16 /> : null}
                    </span>
                  </button>
                ))}
            </>
          )}
        </div>
      )}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutline16 />}
          anchor={rootRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}