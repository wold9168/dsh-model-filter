/**
 * Injected props for the enhanced ModelSelect component.
 */
import type { ModelSelection, ModelProviderGroup, ModelCatalogFailure, SessionModels } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Directory snapshot both entries render from. */
export interface ModelDirectoryState {
  /** Model selection the host reports for the next assembled step; null before the first load. */
  current: ModelSelection | null
  /** Whether an adapter serves the current selection's provider, as the host reports it. */
  routable: boolean | null
  /** Successfully loaded provider groups (last good load). */
  groups: readonly ModelProviderGroup[]
  /** Provider-local failures from the last load; usable groups stay usable. */
  failures: readonly ModelCatalogFailure[]
  /** Lifecycle of the in-flight operation. */
  status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
  /** Whole-request or selection failure text; null when none. */
  error: string | null
}

/** The shared directory controller interface. */
export interface ModelDirectory {
  /** The shared snapshot both entries render from (uSES-safe store). */
  readonly store: SnapshotStore<ModelDirectoryState>
  /** Refresh the advisory directory. */
  load(): Promise<SessionModels>
  /** Select the complete provider/model/reasoning selection. */
  select(selection: ModelSelection): Promise<void>
  /** Drop the previous Host generation's projection and repull it. */
  resetConnected(): void
  /** Scope teardown. */
  dispose(): void
}

/** Props injected into the ModelSelect component. */
export interface ModelSelectInjected {
  /** Whether the model directory is available for this session. */
  available: boolean
  /** The shared model directory controller. */
  directory: ModelDirectory
  /** Trigger a directory reload. */
  load(): void
  /** Submit a model selection. Returns true if accepted. */
  select(selection: ModelSelection): Promise<boolean>
}