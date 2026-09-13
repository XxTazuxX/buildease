import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
 {ignores:['dist/**','coverage/**','playwright-report/**','test-results/**']},
 js.configs.recommended,...tseslint.configs.recommended,
 {files:['**/*.{ts,tsx}'],plugins:{'react-hooks':reactHooks},rules:{
  '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}],
  'react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'error'
 }},
 {files:['src/**/view/**/*.tsx'],rules:{'no-restricted-imports':['error',{patterns:[{group:['@/shared/api/*'],message:'Views must use a ViewModel, not the HTTP client.'}],paths:[{name:'../model/admin',importNames:['adminApi'],message:'Use the administration ViewModel.'}]}]}}
);
