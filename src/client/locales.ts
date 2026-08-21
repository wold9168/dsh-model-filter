/**
 * `model-filter` namespace dictionaries.
 *
 * This namespace only contributes search-related keys. The ModelSelect component
 * also uses keys from the built-in `model` namespace (menu.*, trigger.*, etc.),
 * resolved through the `ExtendedLocale` type in ModelSelect.tsx that intersects
 * `PropsLocale<'model'>` with `ModelFilterKey`.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'search.placeholder': '搜索模型名称或 ID...',
  'search.ariaLabel': '搜索模型',
  'empty.search': '未找到匹配 "{query}" 的模型',
} satisfies Record<string, string>

/** The model-filter namespace key union. */
export type ModelFilterKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'search.placeholder': 'Search model name or ID...',
  'search.ariaLabel': 'Search models',
  'empty.search': 'No models matching "{query}"',
} satisfies Record<ModelFilterKey, string>