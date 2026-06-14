import { useAppStore } from '@/store';
import { Card, Button, Group, Text, Badge, Stack, ScrollArea, ActionIcon, Tooltip } from '@mantine/core';
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react';
import { useState } from 'react';
import { SherdEditorModal } from './SherdEditorModal';

export function SherdList() {
  const sherds = useAppStore((s) => s.sherds);
  const activeSherdId = useAppStore((s) => s.activeSherdId);
  const setActiveSherd = useAppStore((s) => s.setActiveSherd);
  const removeSherd = useAppStore((s) => s.removeSherd);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSherdId, setEditingSherdId] = useState<string | null>(null);

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Group justify="space-between" mb="md">
        <Text fw={600} size="lg">残片管理</Text>
        <Button
          size="sm"
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            setEditingSherdId(null);
            setEditorOpen(true);
          }}
        >
          导入残片
        </Button>
      </Group>

      <ScrollArea h="calc(100% - 60px)">
        {sherds.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            暂无残片，请导入陶器残片图像
          </Text>
        ) : (
          <Stack gap="sm">
            {sherds.map((sherd) => (
              <Card
                key={sherd.id}
                withBorder
                padding="sm"
                radius="md"
                style={{
                  cursor: 'pointer',
                  borderColor: activeSherdId === sherd.id ? 'var(--mantine-color-indigo-5)' : undefined,
                  backgroundColor: activeSherdId === sherd.id ? 'var(--mantine-color-indigo-0)' : undefined,
                }}
                onClick={() => setActiveSherd(sherd.id)}
              >
                <Group justify="space-between">
                  <div>
                    <Group gap="xs" mb={4}>
                      <Text fw={600} size="sm">{sherd.sherdNumber}</Text>
                      <Badge size="xs" color="indigo" variant="light">
                        {sherd.keyPoints.length} 个关键点
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      厚度: {sherd.thickness}mm | 比例: {sherd.scale}
                    </Text>
                  </div>
                  <Group gap={4} onClick={(e) => e.stopPropagation()}>
                    <Tooltip label="编辑">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => {
                          setEditingSherdId(sherd.id);
                          setEditorOpen(true);
                        }}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="删除">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => removeSherd(sherd.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </ScrollArea>

      <SherdEditorModal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        sherdId={editingSherdId}
      />
    </Card>
  );
}
