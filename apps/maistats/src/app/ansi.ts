import { AnsiUp } from 'ansi_up';

export function ansiToSafeHtml(input: string): string {
  const ansiUp = new AnsiUp();
  ansiUp.escape_html = true;
  ansiUp.url_allowlist = {};

  return ansiUp.ansi_to_html(input);
}
