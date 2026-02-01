// Reexport the native module. On web, it will be resolved to UnityModule.web.ts
// and on native platforms to UnityModule.ts
export { default } from './UnityModule';
export { default as UnityView } from './UnityView';
export * from  './Unity.types';
