import { useAppStore } from '@/store';
import { Alert, Badge, Group, Text, Stack, Button, Modal, Textarea, ScrollArea, Card } from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconAlertOctagon,
  IconCheck,
  IconHistory,
  IconUser,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { EvidenceConflict, EditHistoryEntry } from '@/types';

interface EvidenceConflictAlertProps {
  targetType?: 'sherd' | 'scheme';
  targetId?: string;
}

const SEVERITY_MAP: Record<EvidenceConflict['severity'], { icon: any; color: string; label: string }> = {
  low: { icon: IconAlertCircle, color: 'blue', label: '轻微' },
  medium: { icon: IconAlertTriangle, color: 'yellow', label: '中等' },
  high: { icon: IconAlertOctagon, color: 'red', label: '严重' },
};

const TARGET_TYPE_LABELS: Record<EditHistoryEntry['targetType'], string> = {
  sherd: '残片',
  scheme: '方案',
  evidence: '证据来源',
  chronology: '年代判断',
  stratigraphy: '地层信息',
  reference: '参考器物',
  opinion: '专家意见',
};

const ACTION_LABELS: Record<EditHistoryEntry['action'], string> = {
  create: '创建',
  update: '修改',
  delete: '删除',
  restore: '恢复',
};

export function EvidenceConflictAlert({ targetType: propTargetType, targetId: propTargetId }: EvidenceConflictAlertProps) {
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);

  const effectiveTargetType = propTargetType || 'scheme';
  const effectiveTargetId = propTargetId || (effectiveTargetType === 'scheme' ? activeSchemeId : null);

  const evidence = effectiveTargetType === 'sherd' && effectiveTargetId
    ? useAppStore((s) => s.getSherdEvidence(effectiveTargetId))
    : effectiveTargetType === 'scheme' && effectiveTargetId
    ? useAppStore((s) => s.getSchemeEvidence(effectiveTargetId))
    : null;
  const resolveConflict = useAppStore((s) => s.resolveConflict);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  if (!evidence) {
    return null;
  }

  const targetType = effectiveTargetType;
  const targetId = effectiveTargetId || '';

  const unresolved = evidence.conflicts.filter((c) => !c.resolved);
  const resolved = evidence.conflicts.filter((c) => c.resolved);

  if (evidence.conflicts.length === 0 && evidence.editHistory.length === 0) {
    return null;
  }

  return (
    <Stack gap="sm">
      {unresolved.length > 0 && (
        <Stack gap="xs">
          {unresolved.map((conflict) => {
            const sv = SEVERITY_MAP[conflict.severity];
            const Icon = sv.icon;
            return (
              <Alert
                key={conflict.id}
                color={sv.color}
                icon={<Icon size={16} />}
                title={
                  <Group gap="xs">
                    <Badge size="xs" color={sv.color} variant="light">
                      {sv.label}冲突
                    </Badge>
                    <Text size="xs" fw={500}>{conflict.type.replace(/_/g, ' ')}</Text>
                  </Group>
                }
                withCloseButton={false}
              >
                <Stack gap="xs">
                  <Text size="xs">{conflict.description}</Text>
                  <Group justify="flex-end">
                    <Button
                      size="xs"
                      variant="light"
                      color={sv.color}
                      leftSection={<IconCheck size={12} />}
                      onClick={() => setResolvingId(conflict.id)}
                    >
                      标记已解决
                    </Button>
                  </Group>
                </Stack>
              </Alert>
            );
          })}
        </Stack>
      )}

      {resolved.length > 0 && (
        <Alert color="gray" icon={<IconCheck size={16} />} withCloseButton={false}>
          <Group justify="space-between">
            <Text size="xs" fw={500}>已解决冲突 ({resolved.length})</Text>
          </Group>
          <Stack gap="xs" mt="xs">
            {resolved.map((c) => (
              <Text key={c.id} size="xs" c="dimmed">
                ✅ {c.description}
                {c.resolutionNote && ` — ${c.resolutionNote}`}
                {c.resolvedBy && ` (由 ${c.resolvedBy})`}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {evidence.editHistory.length > 0 && (
        <Button
          size="xs"
          variant="light"
          leftSection={<IconHistory size={14} />}
          onClick={() => setHistoryOpen(true)}
        >
          查看修改历史 ({evidence.editHistory.length})
        </Button>
      )}

      <Modal
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="修改历史记录"
        size="lg"
      >
        <ScrollArea h={400}>
          <Stack gap="xs">
            {evidence.editHistory.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="xl">暂无修改记录</Text>
            ) : (
              evidence.editHistory.map((entry) => (
                <Card key={entry.id} withBorder padding="xs" radius="sm">
                  <Group justify="space-between" mb={2}>
                    <Group gap="xs">
                      <Badge
                        size="xs"
                        color={
                          entry.action === 'create'
                            ? 'green'
                            : entry.action === 'update'
                            ? 'blue'
                            : entry.action === 'delete'
                            ? 'red'
                            : 'gray'
                        }
                        variant="light"
                      >
                        {ACTION_LABELS[entry.action]}
                      </Badge>
                      <Text size="xs" fw={500}>
                        {TARGET_TYPE_LABELS[entry.targetType]}
                      </Text>
                      {entry.fieldName && (
                        <Text size="xs" c="dimmed">
                          · {entry.fieldName}
                        </Text>
                      )}
                    </Group>
                    <Text size="10" c="dimmed">
                      {new Date(entry.timestamp).toLocaleString('zh-CN')}
                    </Text>
                  </Group>
                  <Group gap="xs" mt={4}>
                    <IconUser size={10} color="#6b7280" />
                    <Text size="xs" c="dimmed">{entry.userName}</Text>
                  </Group>
                  {entry.summary && (
                    <Text size="xs" mt={4} lineClamp={2}>{entry.summary}</Text>
                  )}
                  {entry.oldValue && entry.newValue && (
                    <Group gap="xs" mt={2}>
                      <Text size="10" c="red" style={{ textDecoration: 'line-through' }}>
                        {entry.oldValue || '(空)'}
                      </Text>
                      <Text size="10">→</Text>
                      <Text size="10" c="green" fw={500}>
                        {entry.newValue || '(空)'}
                      </Text>
                    </Group>
                  )}
                </Card>
              ))
            )}
          </Stack>
        </ScrollArea>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setHistoryOpen(false)}>关闭</Button>
        </Group>
      </Modal>

      {resolvingId && (
        <ResolveConflictModal
          conflictId={resolvingId}
          targetType={targetType}
          targetId={targetId}
          onClose={() => setResolvingId(null)}
          onResolve={(note) => {
            resolveConflict(targetType, targetId, resolvingId, note);
            setResolvingId(null);
          }}
        />
      )}
    </Stack>
  );
}

function ResolveConflictModal({
  conflictId: _conflictId,
  targetType: _targetType,
  targetId: _targetId,
  onClose,
  onResolve,
}: {
  conflictId: string;
  targetType: 'sherd' | 'scheme';
  targetId: string;
  onClose: () => void;
  onResolve: (note: string) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: { resolutionNote: '' },
    validate: {
      resolutionNote: (v) => (!v.trim() ? '请填写解决方案说明' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title="解决证据冲突" size="md">
      <form
        onSubmit={form.onSubmit((values) => {
          onResolve(values.resolutionNote);
        })}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            请描述您是如何解决此冲突的，以及采用了哪一方的证据或结论。
          </Text>
          <Textarea
            label="解决方案说明"
            placeholder="例如：综合参考多篇文献，采用二里头文化四期结论..."
            minRows={3}
            key={form.key('resolutionNote')}
            {...form.getInputProps('resolutionNote')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>取消</Button>
            <Button type="submit" color="green" leftSection={<IconCheck size={14} />}>
              确认解决
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
