import { useState } from 'react';
import { AppShell, Box, Group, Text, Tabs, Container } from '@mantine/core';
import { IconBrush, IconMug, IconChartBar } from '@tabler/icons-react';
import { SherdList } from '@/components/SherdList';
import { SherdCanvas } from '@/components/SherdCanvas';
import { ReconstructionCanvas } from '@/components/ReconstructionCanvas';
import { SchemeManager } from '@/components/SchemeManager';
import { MetricsPanel } from '@/components/MetricsPanel';
import { SchemeComparison } from '@/components/SchemeComparison';
import type { ReconstructionMetrics } from '@/types';

function App() {
  const [metrics, setMetrics] = useState<ReconstructionMetrics | null>(null);

  return (
    <AppShell
      padding="md"
      header={{ height: 60 }}
    >
      <AppShell.Header>
        <Group h="100%" px="xl" justify="space-between">
          <Group gap="sm">
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconMug size={20} color="white" />
            </Box>
            <div>
              <Text fw={700} size="lg" lh={1}>陶器残片复原系统</Text>
              <Text size="xs" c="dimmed">Archaeological Pottery Sherd Reconstruction</Text>
            </div>
          </Group>
          <Text size="sm" c="dimmed">基于口沿曲线、厚度和纹饰的轮廓复原</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Tabs defaultValue="editor" variant="outline" radius="md">
          <Tabs.List mb="md">
            <Tabs.Tab value="editor" leftSection={<IconBrush size={16} />}>
              残片编辑
            </Tabs.Tab>
            <Tabs.Tab value="reconstruction" leftSection={<IconMug size={16} />}>
              复原预览
            </Tabs.Tab>
            <Tabs.Tab value="comparison" leftSection={<IconChartBar size={16} />}>
              方案对比
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="editor">
            <Group grow align="stretch" style={{ height: 'calc(100vh - 180px)' }}>
              <Box style={{ width: 280, flexShrink: 0 }}>
                <SherdList />
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <SherdCanvas />
              </Box>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="reconstruction">
            <Group grow align="stretch" style={{ height: 'calc(100vh - 180px)' }}>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <ReconstructionCanvas onMetricsChange={setMetrics} />
              </Box>
              <Box style={{ width: 340, flexShrink: 0 }}>
                <Group gap="md" style={{ flexDirection: 'column', height: '100%' }} grow>
                  <SchemeManager />
                  <MetricsPanel metrics={metrics} />
                </Group>
              </Box>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="comparison">
            <Container size="xl" py="md">
              <SchemeComparison />
            </Container>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Main>
    </AppShell>
  );
}

export default App;
