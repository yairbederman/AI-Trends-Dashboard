import { ContentType, SourceCategory } from '@/types';

interface ClassifiableItem {
  title: string;
  sourceId: string;
}

const RULES: Array<{
  type: ContentType;
  match: (title: string, sourceCategory?: SourceCategory) => boolean;
}> = [
  {
    type: 'research',
    match: (title, cat) =>
      cat === 'research' ||
      /\b(paper|arxiv|study|findings|dataset)\b/i.test(title),
  },
  {
    type: 'announcement',
    match: (title) =>
      /\b(launch|introducing|announces?|now available|ships?|raises?\s*\$)/i.test(title),
  },
  {
    type: 'tutorial',
    match: (title) =>
      /\b(how to|guide|tutorial|step[- ]by[- ]step|getting started)\b/i.test(title),
  },
  {
    type: 'roundup',
    match: (title) =>
      /\b(weekly|roundup|digest|top \d+|best of)\b/i.test(title),
  },
  {
    type: 'case-study',
    match: (title) =>
      /\b(case study|how we|lessons from|postmortem)\b/i.test(title),
  },
  {
    type: 'discussion',
    match: (_title, cat) => cat === 'community',
  },
];

/**
 * Rule-based content type classifier. First matching rule wins;
 * falls back to 'opinion' if no rule matches.
 */
export function classifyContentType(
  item: ClassifiableItem,
  sourceCategory?: SourceCategory
): ContentType {
  const title = item.title;
  for (const rule of RULES) {
    if (rule.match(title, sourceCategory)) {
      return rule.type;
    }
  }
  return 'opinion';
}
