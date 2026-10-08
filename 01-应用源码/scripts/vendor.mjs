import { cp, mkdir } from 'node:fs/promises';
await mkdir(new URL('../public/vendor/', import.meta.url), { recursive: true });
await cp(new URL('../node_modules/katex/dist/', import.meta.url), new URL('../public/vendor/katex/', import.meta.url), { recursive: true });
console.log('已复制KaTeX及字体，公式可离线渲染。');
