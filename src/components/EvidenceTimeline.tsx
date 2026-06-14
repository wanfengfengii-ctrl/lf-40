import { useAppStore } from '@/store';
import { Card, Group, Text, Badge, Stack, ScrollArea, Divider, Tooltip } from '@mantine/core';
import {
  IconBook,
  IconUser,
  IconClock,
  IconMountain,
  IconHistory,
  IconStar,
} from '@tabler/icons-react';
import type { TimelineEvent, ConfidenceLevel } from '@/types';

interface EvidenceTimelineProps {
  targetType?: 'sherd' | 'scheme';
  targetId?: string;
  title?: string;
}

const CATEGORY_ICONS: Record<TimelineEvent['category'], any> = {
  evidence: IconBook,
  chronology: IconClock,
  stratigraphy: IconMountain,
  reference: IconMountain,
  expert: IconUser,
  edit: IconHistory,
};

const CATEGORY_COLORS: Record<TimelineEvent['category'], string> = {
  evidence: '#6366f1',
  chronology: '#3b82f6',
  stratigraphy: '#f97316',
  reference: '#14b8a6',
  expert: '#8b5cf6',
  edit: '#6b7280',
};

const CATEGORY_LABELS: Record<TimelineEvent['category'], string> = {
  evidence: '证据',
  chronology: '年代',
  stratigraphy: '地层',
  reference: '参考',
  expert: '专家',
  edit: '修改',
};

function ConfidenceIndicator({ level }: { level?: ConfidenceLevel }) {
  if (!level) return null;
  const map: Record<ConfidenceLevel, { color: string; label: string }> = {
    low: { color: '#ef4444', label: '低' },
    medium: { color: '#eab308', label: '中' },
    high: { color: '#3b82f6', label: '高' },
    very_high: { color: '#22c55e', label: '极高' },
  };
  const cfg = map[level];
  return (
    <Group gap={2}>
      {[1, 2, 3, 4].map((i) => {
        const threshold = level === 'low' ? 1 : level === 'medium' ? 2 : level === 'high' ? 3 : 4;
        return (
          <IconStar
            key={i}
            size={10}
            color={cfg.color}
            fill={i <= threshold ? cfg.color : 'transparent'}
          />
        );
      })}
    </Group>
  );
}

export function EvidenceTimeline({ targetType: propTargetType, targetId: propTargetId, title }: EvidenceTimelineProps) {
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);
  const effectiveTargetType = propTargetType || 'scheme';
  const effectiveTargetId = propTargetId || (effectiveTargetType === 'scheme' ? activeSchemeId : null);

  const events = useAppStore((s) =>
    effectiveTargetId ? s.getTimelineEvents(effectiveTargetType, effectiveTargetId) : []
  );

  const groupedEvents = events.reduce((acc, event) => {
    const dateKey = event.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  const dates = Object.keys(groupedEvents).sort((a, b) => b.localeCompare(a));

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Text fw={600} size="lg">{title || '证据时间线'}</Text>
          <Badge size="xs" color="indigo" variant="light">
            共 {events.length} 条
          </Badge>
        </Group>

        <Group gap={8} wrap="wrap">
          {(['chronology', 'stratigraphy', 'reference', 'expert', 'evidence', 'edit'] as const).map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            return (
              <Group key={cat} gap={4}>
                <Icon size={12} color={CATEGORY_COLORS[cat]} />
                <Text size="xs" c="dimmed">{CATEGORY_LABELS[cat]}</Text>
              </Group>
            );
          })}
        </Group>

        <Divider my={0} />

        <ScrollArea h="100%">
          {dates.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              暂无时间线记录
            </Text>
          ) : (
            <Stack gap="md" py="xs">
              {dates.map((date) => (
                <div key={date}>
                  <Group gap="xs" mb="sm">
                    <Badge size="xs" color="gray" variant="light">
                      {date}
                    </Badge>
                    <Divider style={{ flex: 1 }} />
                  </Group>
                  <Stack gap="xs" ml="md">
                    {groupedEvents[date].map((event) => {
                      const Icon = CATEGORY_ICONS[event.category];
                      return (
                        <Group
                          key={event.id}
                          align="flex-start"
                          style={{ position: 'relative' }}
                          gap="xs"
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: `${CATEGORY_COLORS[event.category]}15`,
                              border: `2px solid ${CATEGORY_COLORS[event.category]}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={12} color={CATEGORY_COLORS[event.category]} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Group justify="space-between" gap="xs">
                              <Text size="xs" fw={600} lineClamp={1}>
                                {event.title}
                              </Text>
                              {event.confidenceLevel && (
                                <ConfidenceIndicator level={event.confidenceLevel} />
                              )}
                            </Group>
                            <Tooltip label={event.description} multiline w={280} position="right">
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {event.description}
                              </Text>
                            </Tooltip>
                            {event.author && (
                              <Text size="10" c="dimmed" mt={2}>
                                — {event.author}
                              </Text>
                            )}
                          </div>
                        </Group>
                      );
                    })}
                  </Stack>
                </div>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Stack>
    </Card>
  );
}
