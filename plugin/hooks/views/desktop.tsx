// The desktop pane's own layout: the tab bar and the Overview drawn as boxes,
// type and bars rather than terminal cells, since the desktop sets text in a
// proportional face that no cell-padded row survives. The figures are the
// binary's, word for word; only the layout is the desktop's.
import type { ElementConstructor, ElementTable, RenderElement, TextProps } from 'claude-code';
import type { Model } from '../model';
import { ACCENT, OK, WARN, band, type Seg } from './frame';
import { dashboardOf, type Cell, type OverviewActions } from './overview';

/** The desktop's type props, which the pinned contract (2.1.284) predates. */
type TypeProps = { size?: 'caption' | 'footnote' | 'body' | 'heading' | 'title'; weight?: 'regular' | 'medium' | 'semibold' | 'bold'; mono?: boolean };

export type DesktopElements = Pick<ElementTable<'desktop'>, 'Box' | 'Button'> & { Text: ElementConstructor<TextProps & TypeProps> };

export type Tab = { view: string; label: string };

/** The tabs as one wrapping row: the current view bold in the accent, the rest plain Buttons. */
export function desktopViewBar(tabs: Tab[], current: string, select: (view: string) => void, el: DesktopElements): RenderElement {
  const { Box, Text, Button } = el;
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2} paddingBottom={1}>
      {tabs.map((t) =>
        t.view === current ? (
          <Text key={t.view} color={ACCENT} weight="semibold" underline>
            {t.label}
          </Text>
        ) : (
          <Button key={t.view} label={t.label} plain dimColor onPress={() => select(t.view)} />
        ),
      )}
    </Box>
  );
}

/** Styled runs as one line: the leading runs kept whole, the last one (a row's message) cut to the room left. */
function runs(segs: Seg[], el: DesktopElements, mono = false): RenderElement {
  const { Box, Text } = el;
  const body = segs.filter((s) => s.text.trim() !== '' || s !== segs[segs.length - 1]);
  const last = body[body.length - 1];
  const lead = body.slice(0, -1);
  return (
    <Box flexDirection="row" width="100%" minWidth={0} overflow="hidden">
      {lead.length > 0 && (
        <Box flexShrink={0}>
          <Text mono={mono}>
            {lead.map((s) => (
              <Text color={s.color} dimColor={s.dim} bold={s.bold}>
                {s.text}
              </Text>
            ))}
          </Text>
        </Box>
      )}
      {last !== undefined && (
        <Box flexShrink={1} minWidth={0} overflow="hidden">
          <Text wrap="truncate-end" mono={mono} color={last.color} dimColor={last.dim} bold={last.bold}>
            {last.text}
          </Text>
        </Box>
      )}
    </Box>
  );
}

const plain = (segs: Seg[]): string => segs.map((s) => s.text).join('').trim();

/** A cell's caption by its id; the binary's short form leads with an abbreviation of it. */
const CAPTION: Record<string, string> = { context: 'Context', limits: 'Limits', cache: 'Cache', cost: 'Spend', work: 'Work', tools: 'Tools' };
const ABBREVIATION = new Set(['ctx', 'cache', 'spend']);

/** The first percentage a cell's text carries, as 0–1; null when it has none. */
function percentOf(text: string): number | null {
  const m = /(\d{1,3})\s?%/.exec(text);
  return m === null ? null : Math.min(1, Number(m[1]) / 100);
}

/** A thin bar of `ratio` in theme colours, banded like the TUI's gauges. */
function bar(ratio: number, el: DesktopElements): RenderElement {
  const { Text } = el;
  const filled = Math.round(ratio * BAR_CELLS);
  return (
    <Text mono wrap="truncate-end">
      <Text color={band(ratio, 0.6, 0.85)}>{BAR.repeat(filled)}</Text>
      <Text dimColor>{BAR.repeat(BAR_CELLS - filled)}</Text>
    </Text>
  );
}
const BAR = '━';
const BAR_CELLS = 14;

/** One metric card: the caption (pressable, opens the cell's body), the reading large, the detail dim, a bar when it is a share. */
function card(c: Cell, active: boolean, el: DesktopElements, actions: OverviewActions | undefined): RenderElement {
  const { Box, Text, Button } = el;
  const caption = CAPTION[c.id] ?? c.id;
  const lead = c.short[0];
  const value = lead !== undefined && ABBREVIATION.has(lead.text.trim()) ? c.short.slice(1) : c.short;
  const detail = plain(c.mid.slice(c.short.length));
  const ratio = percentOf(plain(c.short));
  return (
    <Box
      key={`cell_${c.id}`}
      flexDirection="column"
      width="48%"
      borderStyle="round"
      borderColor={active ? OK : undefined}
      borderDimColor={!active}
      paddingX={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        {actions === undefined || active ? (
          <Text size="caption" dimColor={!active} color={active ? OK : undefined}>
            {caption}
          </Text>
        ) : (
          <Button key={`cell-${c.id}`} label={caption} plain dimColor onPress={() => actions.open(c.opens)} />
        )}
        <Text size="caption" dimColor mono>
          {c.key}
        </Text>
      </Box>
      <Text size="heading" weight="semibold" wrap="truncate-end">
        {value.map((s) => (
          <Text color={s.color} dimColor={s.dim}>
            {s.text}
          </Text>
        ))}
      </Text>
      {detail !== '' && (
        <Text size="caption" dimColor wrap="truncate-end">
          {detail}
        </Text>
      )}
      {ratio !== null && bar(ratio, el)}
    </Box>
  );
}

/** The phase pill's colour: busy green, waiting yellow, idle dim. */
function phaseColor(glyph: string): string | undefined {
  return glyph === '●' ? OK : glyph === '◆' ? WARN : undefined;
}

/** The Overview for the desktop: header, metric cards, the coach's line and the open body. */
export function renderDesktopOverview(model: Model, el: DesktopElements, actions?: OverviewActions): RenderElement | null {
  const { Box, Text, Button } = el;
  const d = dashboardOf(model.query.dashboard);
  if (d === null) return null;
  const facts = d.headerLine.replace(/^cctop\s+/, '');
  const pill = phaseColor(d.phase.glyph);
  const shown = d.bodies.find((b) => b.id === model.body) ?? d.bodies.find((b) => b.id === 'events') ?? d.bodies[0];
  return (
    <Box flexDirection="column" rowGap={1}>
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text size="heading" weight="semibold">
            cctop
          </Text>
          <Box borderStyle="round" borderColor={pill} borderDimColor={pill === undefined} paddingX={1}>
            <Text size="caption" weight="semibold" color={pill} dimColor={pill === undefined}>
              {`${d.phase.word} ${d.phase.elapsed}`.trim()}
            </Text>
          </Box>
        </Box>
        <Text size="caption" dimColor wrap="truncate-end">
          {facts}
        </Text>
      </Box>
      <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" rowGap={1}>
        {d.cells.map((c) => card(c, c.opens === model.body, el, actions))}
      </Box>
      {actions === undefined ? (
        runs(d.act.line, el)
      ) : (
        <Button key="advice_saving" label={plain(d.act.line) || 'nothing to act on'} plain dimColor onPress={() => actions.open(d.act.opens)} />
      )}
      {shown !== undefined && (
        <Box flexDirection="column" key={`body_${shown.id}`}>
          <Box flexDirection="row" justifyContent="space-between" alignItems="center" paddingBottom={1}>
            <Text weight="semibold">{shown.title}</Text>
            {shown.id !== 'events' && actions !== undefined && (
              <Button key="cell-home" label="Home" plain dimColor onPress={() => actions.open('events')} />
            )}
          </Box>
          {shown.rows.map((row) => (row.length === 0 ? <Text> </Text> : runs(trimLead(row), el, true)))}
        </Box>
      )}
    </Box>
  );
}

/** A body row without the TUI's left margin. */
function trimLead(row: Seg[]): Seg[] {
  const [first, ...rest] = row;
  return first === undefined ? row : [{ ...first, text: first.text.replace(/^\s+/, '') }, ...rest];
}
