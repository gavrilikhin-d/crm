import type { ru } from "@/i18n/locales/ru";

type TranslationTree = typeof ru;

type Join<K extends string, P extends string> = `${K}.${P}`;

type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? Prefix extends ""
      ? K
      : `${Prefix}.${K}`
    : Paths<T[K], Prefix extends "" ? K : Join<Prefix, K>>;
}[keyof T & string];

type TranslationKey = Paths<TranslationTree>;

type GetValue<T, K extends string> = K extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? GetValue<T[Head], Tail>
    : never
  : K extends keyof T
    ? T[K]
    : never;

type ExtractParams<S extends string> = S extends `${string}{${infer Param}}${infer Rest}`
  ? Param | ExtractParams<Rest>
  : never;

type TranslationParams<K extends TranslationKey> = GetValue<TranslationTree, K> extends string
  ? ExtractParams<GetValue<TranslationTree, K>> extends never
    ? undefined
    : Record<ExtractParams<GetValue<TranslationTree, K>>, string | number>
  : undefined;

export type { TranslationKey, TranslationParams, TranslationTree };
