import { PieChart, Pie, Cell } from 'recharts';
import { Mail, Smartphone, Ticket, Pencil, Check } from 'lucide-react';
import { NOTIFY_RULES, channelKind } from './notifyRules';
import { itsmLogo } from './itsm';
import { ATTENTION_COLOR } from './attention';

type AttentionType = 'True Positive Detected' | 'Threat Intel: High Risk' | 'Threat Intel: Medium Risk' | 'Threat Intel: Low Risk' | 'Tuning: False Positive' | 'No Attention';

type IncidentMetricCardsProps = {
  selectedDate: string;
  statistics: {
    /** tenant is null in single-tenant view, where naming it says nothing. */
    keyThreats: { type: string; tenant: string | null; incidentNumbers: string[] }[];
    attentionCounts: {
      'True Positive Detected': number;
      'Threat Intel: High Risk': number;
      'Threat Intel: Medium Risk': number;
      'Threat Intel: Low Risk': number;
      'Tuning: False Positive': number;
    };
  };
  activeFilters: {
    threatType: string | null;
    threatTenant: string | null;
    attention: AttentionType | null;
  };
  onThreatTypeClick: (threatType: string, tenant: string | null) => void;
  onAttentionClick: (attention: AttentionType) => void;
  /** Opens the Notifications page at a section or a single bucket's rule.
   *  Without it the card is read-only. */
  onOpenNotifications?: (focus: string) => void;
  /** False positives that are still open — what "Close all" would close. */
  openFalsePositives: number;
  /** Asks to close every open false positive. The page confirms first. */
  onCloseFalsePositives?: () => void;
};

// How many channels a tile shows before folding the rest into "+N". Most
// tenants run one ticketing system and one SMS number, so three covers the
// usual case; the full list is on hover.
const MAX_CHIPS = 3;

/** One channel: an address, a phone number, or an ITSM with its logo. */
function ChannelChip({ channel }: { channel: string }) {
  const kind = channelKind(channel);
  const logo = kind === 'itsm' ? itsmLogo(channel) : null;
  return (
    <span className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-[4px] bg-[#2A96A8]/10 text-[11px] text-[#092E3F]">
      {kind === 'email' && <Mail className="w-3 h-3 shrink-0 text-[#092E3F]/70" />}
      {kind === 'sms' && <Smartphone className="w-3 h-3 shrink-0 text-[#092E3F]/70" />}
      {kind === 'itsm' && (logo
        ? <img src={logo} alt="" className="w-3 h-3 shrink-0 object-contain" />
        : <Ticket className="w-3 h-3 shrink-0 text-[#092E3F]/70" />)}
      <span className="truncate">{channel}</span>
    </span>
  );
}

export default function IncidentMetricCards({
  selectedDate,
  statistics,
  activeFilters,
  onThreatTypeClick,
  onAttentionClick,
  onOpenNotifications,
  openFalsePositives,
  onCloseFalsePositives
}: IncidentMetricCardsProps) {

  const incidentRules = NOTIFY_RULES.filter(r => r.section === 'incident');

  // Every classification, always — a bucket at zero is information too.
  const threatAnalysisData = [
    { name: 'True Positives', value: statistics.attentionCounts['True Positive Detected'], color: ATTENTION_COLOR['True Positive Detected'], attentionType: 'True Positive Detected' as AttentionType },
    { name: 'High Risk', value: statistics.attentionCounts['Threat Intel: High Risk'], color: ATTENTION_COLOR['Threat Intel: High Risk'], attentionType: 'Threat Intel: High Risk' as AttentionType },
    { name: 'Medium Risk', value: statistics.attentionCounts['Threat Intel: Medium Risk'], color: ATTENTION_COLOR['Threat Intel: Medium Risk'], attentionType: 'Threat Intel: Medium Risk' as AttentionType },
    { name: 'Low Risk', value: statistics.attentionCounts['Threat Intel: Low Risk'], color: ATTENTION_COLOR['Threat Intel: Low Risk'], attentionType: 'Threat Intel: Low Risk' as AttentionType },
    { name: 'False Positives', value: statistics.attentionCounts['Tuning: False Positive'], color: ATTENTION_COLOR['Tuning: False Positive'], attentionType: 'Tuning: False Positive' as AttentionType },
  ];
  const analysisTotal = threatAnalysisData.reduce((sum, item) => sum + item.value, 0);

  return (
    // Laid out by the width the cards actually get, not the window's: the
    // sidebar and a docked panel both take from it. Three across needs about
    // 340px a card; below that, two with Threat Analysis full width; then one.
    <div className="@container mb-6">
    <div className="grid grid-cols-1 @2xl:grid-cols-2 @min-[66rem]:grid-cols-3 gap-3">
      {/* Card 1: Key Threats */}
      <div className="@container min-w-0 bg-white border border-[var(--stroke)] rounded-[8px] p-[16px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-[#092E3F]">Key Threats</h3>
          <span className="text-xs text-[#092E3F]/40">{selectedDate}</span>
        </div>

        <div className="space-y-2.5">
          {statistics.keyThreats.slice(0, 3).map((threat) => {
            const isActive = activeFilters.threatType === threat.type && activeFilters.threatTenant === threat.tenant;
            const count = threat.incidentNumbers.length;
            const numbersTitle = threat.incidentNumbers.map(n => `#${n}`).join(', ');
            return (
              <button
                key={`${threat.type}-${threat.tenant}`}
                onClick={() => onThreatTypeClick(threat.type, threat.tenant)}
                aria-pressed={isActive}
                // Same hover and selected states as the Notification tiles and
                // Threat Analysis rows: a soft teal tint, never a red alarm.
                className={`w-full flex flex-col items-start gap-0.5 px-2.5 py-[11px] rounded-[8px] text-left border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#2A96A8]/10 border-[#2A96A8]/30'
                    : 'bg-gray-50 border-transparent hover:bg-[#2A96A8]/5 hover:border-[#2A96A8]/30'
                }`}
              >
                <span className="w-full flex items-baseline gap-1 text-xs text-[#092E3F]" title={`${threat.type} (${count}): ${numbersTitle}`}>
                  <span className={`truncate ${isActive ? 'font-medium' : ''}`}>{threat.type}</span>
                  <span className="shrink-0 text-[#092E3F]/50">({count})</span>
                </span>
                {threat.tenant && (
                  <span className="w-full text-[11px] truncate text-[#092E3F]/50">
                    {threat.tenant}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card 2: Incident Notifications — who hears about each kind of incident.
          Set once for the MSSP and shared by every tenant. */}
      <div className="@container min-w-0 bg-white border border-[var(--stroke)] rounded-[8px] p-[16px]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm text-[#092E3F]">Incident Notifications</h3>
          {onOpenNotifications && (
            <button
              type="button"
              onClick={() => onOpenNotifications('incident')}
              title="Manage notifications (applies to all tenants)"
              // Design system Ghost (tertiary) button, small: transparent,
              // body text, Raven-100 fill on hover, radius 8, bold label.
              // Negative margins keep the header the same height as the
              // other cards' headers.
              className="-my-1 -mr-2 shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[8px] bg-transparent text-xs font-bold text-[#092E3F] hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[#2A96A8]/15 focus-visible:border-[#2A96A8] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Manage
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 @min-[18rem]:grid-cols-2 gap-2">
          {incidentRules.map(rule => {
            const order = { email: 0, sms: 1, itsm: 2 };
            const channels = [...rule.channels].sort((x, y) => order[channelKind(x)] - order[channelKind(y)]);
            const shown = channels.slice(0, MAX_CHIPS);
            const hidden = channels.length - shown.length;
            return (
              <button
                key={rule.id}
                type="button"
                disabled={!onOpenNotifications}
                onClick={() => onOpenNotifications?.(rule.id)}
                title={`${rule.when}: ${channels.length ? channels.join(', ') : 'no actions set'}`}
                className="min-w-0 flex flex-col items-start gap-1.5 p-2.5 rounded-[8px] text-left bg-gray-50 border border-transparent hover:border-[#2A96A8]/30 hover:bg-[#2A96A8]/5 transition-colors cursor-pointer disabled:cursor-default"
              >
                <span className="w-full truncate text-xs text-[#092E3F]">{rule.short}</span>
                {channels.length === 0 ? (
                  <span className="text-[11px] text-[#092E3F]/40">No actions set</span>
                ) : (
                  <span className="w-full flex flex-wrap gap-1">
                    {shown.map(c => <ChannelChip key={c} channel={c} />)}
                    {hidden > 0 && (
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[#2A96A8]/10 text-[11px] text-[#092E3F]/70">+{hidden}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card 3: Threat Analysis — how Seculyze classified the incidents */}
      <div className="@container min-w-0 flex flex-col @2xl:col-span-2 @min-[66rem]:col-span-1 bg-white border border-[var(--stroke)] rounded-[8px] p-[16px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-[#092E3F]">Threat Analysis</h3>
          <span className="text-xs text-[#092E3F]/40 whitespace-nowrap">{selectedDate}</span>
        </div>

        {/* Ring on the left for the split at a glance, rows on the right
            carry the numbers */}
        <div className="flex items-center gap-4 @min-[36rem]:justify-center @min-[36rem]:gap-16 mb-3">
          <div className="hidden @min-[20rem]:block w-[120px] h-[120px] shrink-0" aria-hidden="true">
            <PieChart width={120} height={120}>
              <Pie
                data={analysisTotal > 0 ? threatAnalysisData.filter(item => item.value > 0) : [{ name: 'None', value: 1, color: '#f1f4f5' }]}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={analysisTotal > 0 ? 2 : 0}
                dataKey="value"
                isAnimationActive={false}
                stroke="none"
              >
                {(analysisTotal > 0 ? threatAnalysisData.filter(item => item.value > 0) : [{ name: 'None', color: '#f1f4f5' }]).map(entry => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </div>

        {/* Right-aligned rows: label, colour, count — the dots and counts
            line up in columns down the card. */}
        <div className="flex-1 min-w-0 @min-[36rem]:flex-none @min-[36rem]:w-60 space-y-0.5">
          {threatAnalysisData.map(item => {
            const isActive = activeFilters.attention === item.attentionType;
            const muted = item.value === 0;
            return (
              <div key={item.name} className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onAttentionClick(item.attentionType)}
                  aria-pressed={isActive}
                  className={`min-w-0 inline-flex items-center gap-2 pl-2 pr-1 py-1 rounded-[8px] border transition-colors cursor-pointer ${
                    isActive ? 'bg-[#2A96A8]/10 border-[#2A96A8]/30' : 'border-transparent hover:bg-[#2A96A8]/5 hover:border-[#2A96A8]/30'
                  }`}
                >
                  <span className={`truncate text-sm ${muted ? 'text-[#092E3F]/50' : 'text-[#092E3F]'} ${isActive ? 'font-medium' : ''}`}>
                    {item.name}
                  </span>
                  {/* A hairline edge, so the palest tint (false positive) still
                      shows as a dot on the white card. */}
                  <span className="w-3 h-3 rounded-full shrink-0 ring-1 ring-inset ring-[#092e3f]/10" style={{ backgroundColor: item.color }} />
                  <span className={`w-6 text-right text-sm tabular-nums ${muted ? 'text-[#092E3F]/40' : 'text-[#092E3F] font-medium'}`}>
                    {item.value}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        </div>

        {/* The one action on this card, kept out of the rows so they stay
            plain data. It says what it acts on, and only appears when there
            is something to close. */}
        {onCloseFalsePositives && openFalsePositives > 0 && (
          <div className="mt-auto pt-3 border-t border-[var(--stroke)] flex items-center justify-end">
            <button
              type="button"
              onClick={onCloseFalsePositives}
              // Same white button as the table's action column (Isolate device,
              // Block user, Analyze), at the footer's compact size.
              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-xs font-medium whitespace-nowrap bg-white border border-[var(--stroke)] text-[#092E3F] hover:bg-[#092E3F] hover:border-[#092E3F] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A96A8]/40 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Review & Close {openFalsePositives} False Positive{openFalsePositives !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}