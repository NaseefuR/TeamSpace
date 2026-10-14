import type { ElementType, ReactNode } from "react";

const inlinePattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_)/g;

function inline(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  inlinePattern.lastIndex = 0;
  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const key = `${prefix}-${index++}`;
    if (match[2] && match[3]) {
      nodes.push(<a key={key} href={match[3]} target="_blank" rel="noreferrer" className="font-medium text-violet underline underline-offset-2">{match[2]}</a>);
    } else if (match[4]) {
      nodes.push(<code key={key} className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[.9em]">{match[4]}</code>);
    } else if (match[5] || match[6]) {
      nodes.push(<strong key={key} className="font-semibold">{match[5] ?? match[6]}</strong>);
    } else {
      nodes.push(<em key={key}>{match[7] ?? match[8]}</em>);
    }
    cursor = inlinePattern.lastIndex;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function cells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
}

function isList(line: string) { return /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line); }
function isBlockStart(lines: string[], index: number) {
  const line = lines[index];
  return /^\s*(?:#{1,6}\s|```|~~~|>|[-*_]{3,}\s*$)/.test(line) || isList(line) || (index + 1 < lines.length && line.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]));
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^\s*(```|~~~)/.test(line)) {
      const marker = line.trim().slice(0, 3);
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index].trim().startsWith(marker)) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push(<pre key={`block-${blocks.length}`} className="my-3 overflow-x-auto rounded-xl bg-[#161821] p-4 text-xs leading-5 text-[#eef0f7]"><code className={language ? `language-${language}` : undefined}>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const contentNodes = inline(heading[2], `h-${blocks.length}`);
      const className = level === 1 ? "mb-2 mt-4 text-xl font-bold" : level === 2 ? "mb-2 mt-4 text-lg font-semibold" : "mb-1 mt-3 text-base font-semibold";
      const Tag = `h${level}` as ElementType;
      blocks.push(<Tag key={`block-${blocks.length}`} className={className}>{contentNodes}</Tag>);
      index++;
      continue;
    }
    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr key={`block-${blocks.length}`} className="my-3 border-line"/>);
      index++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ""));
      blocks.push(<blockquote key={`block-${blocks.length}`} className="my-3 border-l-2 border-violet/40 pl-4 text-muted">{quote.map((text, n) => <p key={n}>{inline(text, `q-${blocks.length}-${n}`)}</p>)}</blockquote>);
      continue;
    }
    if (index + 1 < lines.length && line.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1])) {
      const headers = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(cells(lines[index++]));
      blocks.push(<div key={`block-${blocks.length}`} className="my-3 overflow-x-auto"><table className="min-w-full border-collapse text-left text-sm"><thead><tr>{headers.map((cell, n) => <th key={n} className="border-b border-line px-3 py-2 font-semibold">{inline(cell, `th-${blocks.length}-${n}`)}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}>{headers.map((_, ci) => <td key={ci} className="border-b border-line/70 px-3 py-2 align-top">{inline(row[ci] ?? "", `td-${blocks.length}-${ri}-${ci}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (isList(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && isList(lines[index]) && /^\s*\d+[.)]\s+/.test(lines[index]) === ordered) {
        items.push(lines[index++].replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, ""));
      }
      const listItems = items.map((text, n) => <li key={n} className="pl-1">{inline(text, `li-${blocks.length}-${n}`)}</li>);
      blocks.push(ordered ? <ol key={`block-${blocks.length}`} className="my-2 list-decimal space-y-1 pl-6">{listItems}</ol> : <ul key={`block-${blocks.length}`} className="my-2 list-disc space-y-1 pl-6">{listItems}</ul>);
      continue;
    }
    const paragraph = [line.trim()];
    index++;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) paragraph.push(lines[index++].trim());
    blocks.push(<p key={`block-${blocks.length}`} className="my-2 whitespace-pre-wrap">{inline(paragraph.join("\n"), `p-${blocks.length}`)}</p>);
  }
  return <div className="break-words">{blocks}</div>;
}
