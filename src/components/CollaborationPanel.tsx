import { useAppStore } from '@/store';
import {
  Card,
  Group,
  Text,
  Badge,
  Stack,
  ActionIcon,
  Tooltip,
  Modal,
  TextInput,
  Select,
  Button,
  Avatar,
  Divider,
  ScrollArea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconUsers,
  IconPlus,
  IconTrash,
  IconUserCheck,
  IconClock,
  IconEdit,
  IconCrown,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { Collaborator } from '@/types';

const ROLE_OPTIONS = [
  { value: 'lead', label: '负责人' },
  { value: 'expert', label: '专家' },
  { value: 'assistant', label: '助理' },
  { value: 'reviewer', label: '审核人' },
];

const ROLE_COLORS: Record<Collaborator['role'], string> = {
  lead: '#6366f1',
  expert: '#8b5cf6',
  assistant: '#06b6d4',
  reviewer: '#f59e0b',
};

const ROLE_LABELS: Record<Collaborator['role'], string> = {
  lead: '负责人',
  expert: '专家',
  assistant: '助理',
  reviewer: '审核人',
};

function isRecentlyActive(timestamp?: number): boolean {
  if (!timestamp) return false;
  return Date.now() - timestamp < 5 * 60 * 1000;
}

function formatLastActive(timestamp?: number): string {
  if (!timestamp) return '未知';
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

export function CollaborationPanel() {
  const collaborators = useAppStore((s) => s.collaborators);
  const currentCollaborator = useAppStore((s) => s.currentCollaborator);
  const setCurrentCollaborator = useAppStore((s) => s.setCurrentCollaborator);
  const addCollaborator = useAppStore((s) => s.addCollaborator);
  const removeCollaborator = useAppStore((s) => s.removeCollaborator);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeCount = collaborators.filter((c) => isRecentlyActive(c.lastActiveAt)).length;

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Group gap="xs">
            <IconUsers size={18} color="#6366f1" />
            <Text fw={600} size="lg">协同标注</Text>
          </Group>
          <Group gap={4}>
            <Badge size="xs" color="green" variant="light">
              {activeCount} 在线
            </Badge>
            <Badge size="xs" color="indigo" variant="light">
              共 {collaborators.length} 人
            </Badge>
            <Tooltip label="添加协作者">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="indigo"
                onClick={() => setAddModalOpen(true)}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <Divider my={0} />

        <Group gap="xs" py={4}>
          <Text size="xs" fw={500} c="dimmed">
            当前身份
          </Text>
          <Badge
            size="xs"
            color={ROLE_COLORS[currentCollaborator.role]}
            variant="light"
            leftSection={<IconUserCheck size={10} />}
          >
            {currentCollaborator.name}
          </Badge>
          <Tooltip label="切换身份">
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={() => {
                setEditingId(currentCollaborator.id);
                setEditModalOpen(true);
              }}
            >
              <IconEdit size={12} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Divider my={0} />

        <ScrollArea h="100%">
          <Stack gap="xs" py="xs">
            {collaborators.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                暂无协作者
              </Text>
            ) : (
              collaborators.map((c) => {
                const isActive = isRecentlyActive(c.lastActiveAt);
                const isCurrent = c.id === currentCollaborator.id;
                return (
                  <Card
                    key={c.id}
                    withBorder
                    padding="xs"
                    radius="sm"
                    style={{
                      borderColor: isCurrent ? '#6366f1' : undefined,
                      backgroundColor: isCurrent ? '#f5f3ff' : undefined,
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="xs">
                        <div style={{ position: 'relative' }}>
                          <Avatar
                            size={28}
                            color={c.avatarColor || '#6366f1'}
                            radius="xl"
                          >
                            {c.name.charAt(0)}
                          </Avatar>
                          <div
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              backgroundColor: isActive ? '#22c55e' : '#9ca3af',
                              border: '2px solid white',
                            }}
                          />
                        </div>
                        <div>
                          <Group gap={4}>
                            <Text size="xs" fw={600}>
                              {c.name}
                              {c.role === 'lead' && (
                                <IconCrown
                                  size={12}
                                  color="#f59e0b"
                                  style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }}
                                />
                              )}
                              {isCurrent && (
                                <Badge size="xs" color="indigo" variant="light" ml={4}>
                                  当前
                                </Badge>
                              )}
                            </Text>
                          </Group>
                          <Group gap={4} mt={2}>
                            <Badge
                              size="xs"
                              color={ROLE_COLORS[c.role]}
                              variant="light"
                            >
                              {ROLE_LABELS[c.role]}
                            </Badge>
                            <Text size="10" c="dimmed">
                              <IconClock
                                size={10}
                                style={{ display: 'inline', verticalAlign: 'middle' }}
                              />{' '}
                              {formatLastActive(c.lastActiveAt)}
                            </Text>
                          </Group>
                        </div>
                      </Group>
                      <Group gap={2}>
                        {!isCurrent && (
                          <Tooltip label="切换到此身份">
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="indigo"
                              onClick={() => setCurrentCollaborator(c)}
                            >
                              <IconUserCheck size={12} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {!isCurrent && c.role !== 'lead' && (
                          <Tooltip label="移除协作者">
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              color="red"
                              onClick={() => removeCollaborator(c.id)}
                            >
                              <IconTrash size={12} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>
                  </Card>
                );
              })
            )}
          </Stack>
        </ScrollArea>
      </Stack>

      {addModalOpen && (
        <AddCollaboratorModal
          onClose={() => setAddModalOpen(false)}
          onAdd={(values) => {
            const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ec4899'];
            addCollaborator({
              ...values,
              avatarColor: colors[Math.floor(Math.random() * colors.length)],
            });
            setAddModalOpen(false);
          }}
        />
      )}

      {editModalOpen && editingId && (
        <EditCollaboratorModal
          collaborator={currentCollaborator}
          onClose={() => {
            setEditModalOpen(false);
            setEditingId(null);
          }}
          onSave={(values) => {
            setCurrentCollaborator(values);
            setEditModalOpen(false);
            setEditingId(null);
          }}
        />
      )}
    </Card>
  );
}

function AddCollaboratorModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (values: Omit<Collaborator, 'id' | 'lastActiveAt'>) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      name: '',
      role: 'assistant' as Collaborator['role'],
    },
    validate: {
      name: (v) => (!v.trim() ? '请输入协作者姓名' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title="添加协作者" size="sm">
      <form
        onSubmit={form.onSubmit((values) => {
          onAdd(values);
        })}
      >
        <Stack gap="md">
          <TextInput
            label="协作者姓名"
            placeholder="请输入姓名"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Select
            label="角色"
            data={ROLE_OPTIONS}
            key={form.key('role')}
            {...form.getInputProps('role')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" leftSection={<IconPlus size={14} />}>
              添加
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function EditCollaboratorModal({
  collaborator,
  onClose,
  onSave,
}: {
  collaborator: Collaborator;
  onClose: () => void;
  onSave: (values: Partial<Collaborator>) => void;
}) {
  const form = useForm({
    mode: 'controlled',
    initialValues: {
      name: collaborator.name,
      role: collaborator.role as Collaborator['role'],
    },
    validate: {
      name: (v) => (!v.trim() ? '请输入姓名' : null),
    },
  });

  return (
    <Modal opened onClose={onClose} title="编辑当前身份" size="sm">
      <form
        onSubmit={form.onSubmit((values) => {
          onSave(values);
        })}
      >
        <Stack gap="md">
          <TextInput
            label="姓名"
            placeholder="请输入姓名"
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <Select
            label="角色"
            data={ROLE_OPTIONS}
            key={form.key('role')}
            {...form.getInputProps('role')}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" leftSection={<IconUserCheck size={14} />}>
              保存
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
