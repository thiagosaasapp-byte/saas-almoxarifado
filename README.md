# yarin-almox

Projeto React + Vite + Tailwind pronto para deploy no Netlify.

## Rodar localmente
```bash
npm install
npm run dev
```

## Deploy no Netlify
1. Suba a pasta para um repositório no GitHub.
2. No Netlify, clique em **Add new site → Import from Git** e selecione o repo.
3. As configurações vêm do `netlify.toml` (build: `npm run build`, publish: `dist`).
4. Deploy!

## Estrutura de entrada multi-arquivo
Cole código com marcadores para gerar múltiplos arquivos:
```
// === src/App.tsx ===
export default function App(){ ... }

// === src/components/Header.tsx ===
export function Header(){ ... }
```
