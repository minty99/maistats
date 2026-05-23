import { describe, expect, it } from 'vitest';

import { ansiToSafeHtml } from './ansi';

describe('ansiToSafeHtml', () => {
  it('converts tracing field styles into HTML spans', () => {
    expect(ansiToSafeHtml('request{\u001b[3mmethod\u001b[0m\u001b[2m=\u001b[0mGET}')).toBe(
      'request{<span style="font-style:italic">method</span><span style="opacity:0.7">=</span>GET}',
    );
  });

  it('converts common color and intensity codes', () => {
    const html = ansiToSafeHtml('\u001b[32mINFO\u001b[0m \u001b[1;91mfailed\u001b[22;39m!');

    expect(html).toContain('<span style="color:rgb(0,187,0)">INFO</span>');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('failed');
    expect(html).not.toContain('[0m');
  });

  it('escapes HTML from log text', () => {
    expect(ansiToSafeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});
