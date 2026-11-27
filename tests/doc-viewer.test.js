import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { normalizeDisplayMath } from '../src/components/common/markdown-math.js';
import {
  clampZoom,
  computeFitZoom,
  computeInlineMermaidLayout,
  parseSvgDimensions,
} from '../src/components/common/mermaid-svg.js';
import {
  formatCodeLanguageLabel,
  getCodeFileExtension,
  normalizeCodeLanguage,
  tokenizeCodeLines,
} from '../src/components/common/code-highlight.js';

function collectDocFiles() {
  const rootPath = fileURLToPath(new URL('../fastapi-backend/app/firmware/curriculum/', import.meta.url));
  const files = [];
  for (const dir of readdirSync(rootPath).sort()) {
    const dirPath = join(rootPath, dir);
    if (!statSync(dirPath).isDirectory()) continue;
    for (const name of readdirSync(dirPath).sort()) {
      if (name.startsWith('doc-') && name.endsWith('.md')) {
        files.push(join(dirPath, name));
      }
    }
  }
  return files;
}

function stripCodeBlocksAndInlineCode(html) {
  return html
    .replace(/<pre[\s\S]*?<\/pre>/g, '')
    .replace(/<code[\s\S]*?<\/code>/g, '');
}

test('normalizeDisplayMath converts single-line, multi-line, and blockquote $$ blocks while preserving code fences', () => {
  const input = [
    '# Heading',
    '',
    '$$a + b = c$$',
    '',
    '$$f = \\left(\\frac{1}{2}',
    '\\right)$$',
    '',
    '> $$x^2 + y^2$$',
    '> $$z = \\left(1 + 2',
    '> \\right)$$',
    '',
    '```markdown',
    '$$should_stay_single_line$$',
    '```',
    '',
    '~~~',
    '$$also_untouched$$',
    '~~~',
    '',
    'Inline $E = mc^2$ and mid-line text $$x$$ stay inline.',
  ].join('\n');

  const expected = [
    '# Heading',
    '',
    '$$',
    'a + b = c',
    '$$',
    '',
    '$$',
    'f = \\left(\\frac{1}{2}',
    '\\right)',
    '$$',
    '',
    '> $$',
    '> x^2 + y^2',
    '> $$',
    '> $$',
    '> z = \\left(1 + 2',
    '> \\right)',
    '> $$',
    '',
    '```markdown',
    '$$should_stay_single_line$$',
    '```',
    '',
    '~~~',
    '$$also_untouched$$',
    '~~~',
    '',
    'Inline $E = mc^2$ and mid-line text $$x$$ stay inline.',
  ].join('\n');

  assert.equal(normalizeDisplayMath(input), expected);
});

test('normalizeDisplayMath leaves unclosed $$ untouched without swallowing trailing sections', () => {
  const input = [
    '$$x + y',
    '',
    '### Section After Unclosed',
    'Normal paragraph.',
  ].join('\n');

  assert.equal(normalizeDisplayMath(input), input);
});

test('normalizeDisplayMath preserves list indentation so trailing explanations stay paragraphs instead of Plain Text code blocks', () => {
  const input = [
    '1. **Nhiệt Hấp thụ:**',
    '   - **Bức xạ Mặt Trời:** Công suất hấp thụ:',
    '$$Q_{\\text{solar}} = \\alpha \\cdot A_{\\text{proj}} \\cdot G_{sc}$$',
    '     (với $\\alpha$ là hệ số hấp thụ quang học).',
  ].join('\n');

  const html = renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [[rehypeKatex, { strict: false }]],
      },
      normalizeDisplayMath(input),
    ),
  );

  assert.equal(html.includes('<pre>'), false);
  assert.ok(html.includes('katex-display'));
  assert.ok(html.includes('với'));
});

test('all 35 curriculum docs render without KaTeX errors, raw $$, dropped headings, or accidental Plain Text code blocks', () => {
  const files = collectDocFiles();
  assert.equal(files.length, 35);
  let unlabeledPreCount = 0;

  for (const file of files) {
    const md = readFileSync(file, 'utf8');
    const normalized = normalizeDisplayMath(md);
    const html = renderToStaticMarkup(
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm, remarkMath],
          rehypePlugins: [[rehypeKatex, { strict: false }]],
        },
        normalized,
      ),
    );

    assert.equal(html.includes('katex-error'), false, `${file} rendered katex-error`);
    assert.equal(html.includes('>undefined<'), false, `${file} rendered undefined`);
    assert.equal(html.includes('color:#cc0000'), false, `${file} rendered red error text`);

    const preMatches = [...html.matchAll(/<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g)];
    for (const match of preMatches) {
      const cls = match[1] || '';
      if (!cls.includes('language-')) {
        unlabeledPreCount += 1;
        assert.match(match[2], /^\$GP(?:RMC|GGA),/, `${file} rendered unexpected Plain Text block: ${match[2].slice(0, 80)}`);
      }
    }

    const nonCodeHtml = stripCodeBlocksAndInlineCode(html);
    assert.equal(nonCodeHtml.includes('$$'), false, `${file} left raw $$ in non-code HTML`);

    const mdWithoutCode = md.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
    const mdHeadingCount = (mdWithoutCode.match(/^#{1,6}\s+.+$/gm) || []).length;
    const htmlHeadingCount = (html.match(/<h[1-6][^>]*>/g) || []).length;
    assert.equal(htmlHeadingCount, mdHeadingCount, `${file} dropped or added headings`);
  }

  assert.equal(unlabeledPreCount, 2);
});

test('doc-5-1 renders complete sections including FSPL, diagrams, Link Budget, and Doppler', () => {
  const md = readFileSync(
    new URL('../fastapi-backend/app/firmware/curriculum/lab5/doc-5-1.md', import.meta.url),
    'utf8',
  );
  const html = renderToStaticMarkup(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [[rehypeKatex, { strict: false }]],
      },
      normalizeDisplayMath(md),
    ),
  );

  assert.ok(html.includes('Link Budget'));
  assert.ok(html.includes('Doppler'));
  assert.ok(html.includes('katex-display'));
  assert.ok(html.includes('<img'));
});

test('parseSvgDimensions parses viewBox, attribute fallback, and rejects invalid SVG', () => {
  assert.deepEqual(
    parseSvgDimensions('<svg viewBox="0 0 2400 420" width="100%"></svg>'),
    { width: 2400, height: 420 },
  );
  assert.deepEqual(
    parseSvgDimensions('<svg viewBox="-8 -8 640.5 300.25"></svg>'),
    { width: 640.5, height: 300.25 },
  );
  assert.deepEqual(
    parseSvgDimensions('<svg width="800" height="320"></svg>'),
    { width: 800, height: 320 },
  );
  assert.equal(parseSvgDimensions('<div>not svg</div>'), null);
  assert.equal(parseSvgDimensions(''), null);
});

test('computeInlineMermaidLayout handles narrow vs wide diagrams and inline scale modes', () => {
  const narrow = computeInlineMermaidLayout({ width: 700, height: 300 }, 'readable');
  assert.deepEqual(narrow, {
    isWide: false,
    mode: 'fit',
    displayWidthPx: 700,
    fitContainer: true,
  });

  const wideDefault = computeInlineMermaidLayout({ width: 2400, height: 420 });
  assert.deepEqual(wideDefault, {
    isWide: true,
    mode: 'fit',
    displayWidthPx: 2400,
    fitContainer: true,
  });

  const wideReadable = computeInlineMermaidLayout({ width: 2400, height: 420 }, 'readable');
  assert.deepEqual(wideReadable, {
    isWide: true,
    mode: 'readable',
    displayWidthPx: 1920,
    fitContainer: false,
  });

  const wideActual = computeInlineMermaidLayout({ width: 2400, height: 420 }, 'actual');
  assert.deepEqual(wideActual, {
    isWide: true,
    mode: 'actual',
    displayWidthPx: 2400,
    fitContainer: false,
  });

  const wideFit = computeInlineMermaidLayout({ width: 2400, height: 420 }, 'fit');
  assert.deepEqual(wideFit, {
    isWide: true,
    mode: 'fit',
    displayWidthPx: 2400,
    fitContainer: true,
  });
});

test('clampZoom and computeFitZoom respect bounds and viewport dimensions', () => {
  assert.equal(clampZoom(0.1), 0.4);
  assert.equal(clampZoom(5), 3);
  assert.equal(clampZoom(1.25), 1.25);

  assert.equal(computeFitZoom({ width: 2400, height: 420 }, 1248, 800), 0.5);
  assert.equal(computeFitZoom({ width: 400, height: 200 }, 1248, 800), 1.5);
  assert.equal(computeFitZoom(null, 1248, 800), 1);
});

test('normalizeCodeLanguage and formatCodeLanguageLabel handle common aliases', () => {
  assert.equal(normalizeCodeLanguage('cpp'), 'cpp');
  assert.equal(normalizeCodeLanguage('language-ino'), 'cpp');
  assert.equal(normalizeCodeLanguage('py'), 'python');
  assert.equal(normalizeCodeLanguage(''), 'text');
  assert.equal(formatCodeLanguageLabel('ino'), 'C++');
  assert.equal(formatCodeLanguageLabel('python'), 'Python');
  assert.equal(formatCodeLanguageLabel('unknown'), 'Plain Text');
  assert.equal(getCodeFileExtension('cpp'), 'cpp');
  assert.equal(getCodeFileExtension('py'), 'py');
  assert.equal(getCodeFileExtension(''), 'txt');
});

test('tokenizeCodeLines highlights C++/Arduino syntax accurately and round-trips exact text', () => {
  const sample = [
    '#include <PTITCube.h>',
    'const int LED_PIN = 2;',
    '',
    '/* Multi-line',
    '   comment */',
    'void setup() {',
    '  pinMode(LED_PIN, OUTPUT);',
    '  if (LED_PIN == 2) Serial.begin(115200); // UART',
    '}',
  ].join('\n');

  const lines = tokenizeCodeLines(`${sample}\n`, 'cpp');
  assert.equal(lines.length, 9);
  assert.equal(lines.map(toks => toks.map(t => t.value).join('')).join('\n'), sample);

  assert.equal(lines[0][0].type, 'preprocessor');
  assert.equal(lines[0][2].type, 'string');

  const ledPinLine = lines[1];
  assert.ok(ledPinLine.some(t => t.type === 'keyword' && t.value === 'const'));
  assert.ok(ledPinLine.some(t => t.type === 'keyword' && t.value === 'int'));
  assert.ok(ledPinLine.some(t => t.type === 'constant' && t.value === 'LED_PIN'));
  assert.ok(ledPinLine.some(t => t.type === 'number' && t.value === '2'));

  assert.deepEqual(lines[2], []);
  assert.equal(lines[3][0].type, 'comment');
  assert.equal(lines[4][0].type, 'comment');

  assert.ok(lines[5].some(t => t.type === 'keyword' && t.value === 'void'));
  assert.ok(lines[5].some(t => t.type === 'function' && t.value === 'setup'));
  assert.ok(lines[6].some(t => t.type === 'function' && t.value === 'pinMode'));
  assert.ok(lines[6].some(t => t.type === 'constant' && t.value === 'OUTPUT'));
  assert.ok(lines[7].some(t => t.type === 'control' && t.value === 'if'));
  assert.ok(lines[7].some(t => t.type === 'type' && t.value === 'Serial'));
  assert.ok(lines[7].some(t => t.type === 'function' && t.value === 'begin'));
  assert.ok(lines[7].some(t => t.type === 'comment' && t.value === '// UART'));
});

test('tokenizeCodeLines keeps unlabeled snippets plain without false coloring', () => {
  const nmea = '$GPRMC,083559.00,A,2102.1234,N,10547.5678,E,0.05,84.4,121126,,,A*76';
  const lines = tokenizeCodeLines(nmea, '');
  assert.deepEqual(lines, [[{ type: 'plain', value: nmea }]]);
});

test('Mermaid diagrams parse cleanly without DOM leaks', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const prevWindow = globalThis.window;
  const prevDocument = globalThis.document;
  const prevDOMParser = globalThis.DOMParser;

  globalThis.window = /** @type {any} */ (dom.window);
  globalThis.document = dom.window.document;
  globalThis.DOMParser = dom.window.DOMParser;

  try {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true });

    await mermaid.parse('flowchart LR\n  A[OBC] --> B[COM]');
    assert.equal(dom.window.document.body.innerHTML, '', 'sample diagram leaked DOM nodes during parse');

    const files = collectDocFiles();
    for (const file of files) {
      const md = readFileSync(file, 'utf8');
      const re = /```mermaid\r?\n([\s\S]*?)```/g;
      let match;
      let index = 0;
      while ((match = re.exec(md)) !== null) {
        index += 1;
        await mermaid.parse(match[1].trim());
        assert.equal(dom.window.document.body.innerHTML, '', `${file}#${index} leaked DOM nodes during parse`);
      }
    }
  } finally {
    globalThis.window = prevWindow;
    globalThis.document = prevDocument;
    globalThis.DOMParser = prevDOMParser;
  }
});
