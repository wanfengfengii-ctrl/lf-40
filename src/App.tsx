import { useState, useMemo } from 'react';
import { AppShell, Box, Group, Text, Tabs, Container, Badge, Tooltip, ActionIcon, TextInput, Modal, Button, Stack, FileButton, Textarea, Alert, Divider, ScrollArea, Card } from '@mantine/core';
import { IconBrush, IconMug, IconChartBar, IconEdit, IconCheck, IconFolderOpen, IconDownload, IconUpload, IconTrashX, IconDeviceFloppy, IconCloudCheck, IconCloudUpload, IconFileText, IconTimeline, IconDatabase, IconFlask, IconBulb } from '@tabler/icons-react';
import { SherdList } from '@/components/SherdList';
import { SherdCanvas } from '@/components/SherdCanvas';
import { ReconstructionCanvas } from '@/components/ReconstructionCanvas';
import { SchemeManager } from '@/components/SchemeManager';
import { MetricsPanel } from '@/components/MetricsPanel';
import { SchemeComparison } from '@/components/SchemeComparison';
import { EvidenceAnnotationPanel } from '@/components/EvidenceAnnotationPanel';
import { EvidenceTimeline } from '@/components/EvidenceTimeline';
import { EvidenceConflictAlert } from '@/components/EvidenceConflictAlert';
import { ReportGenerator } from '@/components/ReportGenerator';
import { CollaborationPanel } from '@/components/CollaborationPanel';
import { KnowledgeBaseBrowser } from '@/components/KnowledgeBaseBrowser';
import { SmartComparisonPanel } from '@/components/SmartComparisonPanel';
import { RecommendationPanel } from '@/components/RecommendationPanel';
import { useAppStore } from '@/store';
import type { ReconstructionMetrics } from '@/types';

function App() {
  const [metrics, setMetrics] = useState<ReconstructionMetrics | null>(null);
  const projectName = useAppStore((s) => s.projectName);
  const setProjectName = useAppStore((s) => s.setProjectName);
  const projectMetadata = useAppStore((s) => s.projectMetadata);
  const setProjectMetadata = useAppStore((s) => s.setProjectMetadata);
  const saveProjectToFile = useAppStore((s) => s.saveProjectToFile);
  const loadProjectFromFile = useAppStore((s) => s.loadProjectFromFile);
  const clearProject = useAppStore((s) => s.clearProject);
  const lastAutoSaveAt = useAppStore((s) => s.lastAutoSaveAt);
  const autoSaveEnabled = useAppStore((s) => s.autoSaveEnabled);
  const setAutoSaveEnabled = useAppStore((s) => s.setAutoSaveEnabled);
  const sherds = useAppStore((s) => s.sherds);
  const schemes = useAppStore((s) => s.schemes);
  const knowledgeBase = useAppStore((s) => s.knowledgeBase);

  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [metaForm, setMetaForm] = useState(projectMetadata || {});
  const showAutoSaveFlash = useMemo(() => {
    return lastAutoSaveAt !== null && lastAutoSaveAt > 0;
  }, [lastAutoSaveAt]);

  const handleSaveName = () => {
    if (tempName.trim()) {
      setProjectName(tempName.trim());
    }
    setEditingName(false);
  };

  const handleOpenProjectModal = () => {
    setMetaForm(projectMetadata || {});
    setProjectError(null);
    setProjectModalOpen(true);
  };

  const handleLoadProject = async (file: File | null) => {
    if (!file) return;
    setProjectError(null);
    const result = await loadProjectFromFile(file);
    if (!result.success) {
      setProjectError(result.error || '加载失败');
    } else {
      setProjectModalOpen(false);
    }
  };

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return '未保存';
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const totalKeyPoints = sherds.reduce((acc, s) => acc + s.keyPoints.length, 0);
  const trustedSchemes = schemes.filter(s => s.isTrusted).length;
  const totalVersions = schemes.reduce((acc, s) => acc + (s.versions?.length || 0), 0);

  return (
    <AppShell
      padding="md"
      header={{ height: 68 }}
    >
      <AppShell.Header>
        <Group h="100%" px="xl" justify="space-between">
          <Group gap="sm">
            <Box
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconMug size={22} color="white" />
            </Box>
            <div>
              <Group gap={6}>
                {editingName ? (
                  <TextInput
                    size="xs"
                    w={220}
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    onBlur={handleSaveName}
                    autoFocus
                    rightSection={
                      <ActionIcon size="xs" variant="subtle" color="green" onClick={handleSaveName}>
                        <IconCheck size={12} />
                      </ActionIcon>
                    }
                  />
                ) : (
                  <Group gap={4}>
                    <Text fw={700} size="lg" lh={1}>{projectName}</Text>
                    <Tooltip label="重命名项目">
                      <ActionIcon size="xs" variant="subtle" onClick={() => {
                        setTempName(projectName);
                        setEditingName(true);
                      }}>
                        <IconEdit size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </Group>
              <Text size="xs" c="dimmed">陶器残片智能复原系统 | Archaeological Pottery Sherd Reconstruction</Text>
            </div>
          </Group>
          <Group gap="sm">
            <Badge size="sm" variant="light" color="indigo">
              <IconBrush size={10} style={{ marginRight: 4 }} />
              {sherds.length} 残片
            </Badge>
            <Badge size="sm" variant="light" color="grape">
              <IconMug size={10} style={{ marginRight: 4 }} />
              {schemes.length} 方案
            </Badge>
            {trustedSchemes > 0 && (
              <Badge size="sm" variant="light" color="green">
                <IconCheck size={10} style={{ marginRight: 4 }} />
                {trustedSchemes} 可信
              </Badge>
            )}
            <Badge size="sm" variant="light" color="indigo">
              <IconDatabase size={10} style={{ marginRight: 4 }} />
              知识库 {knowledgeBase.length}
            </Badge>
            <Tooltip label="保存项目">
              <ActionIcon variant="light" color="indigo" onClick={() => saveProjectToFile()}>
                <IconDeviceFloppy size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="项目管理">
              <ActionIcon variant="light" color="grape" onClick={handleOpenProjectModal}>
                <IconFolderOpen size={18} />
              </ActionIcon>
            </Tooltip>
            <Group gap={4}>
              {autoSaveEnabled ? (
                <Tooltip label={lastAutoSaveAt ? `自动保存于 ${formatTimestamp(lastAutoSaveAt)}` : '自动保存已开启'}>
                  <Badge
                    size="xs"
                    variant="light"
                    color={showAutoSaveFlash ? 'green' : 'gray'}
                    leftSection={<IconCloudCheck size={10} />}
                    style={{ transition: 'all 0.3s ease' }}
                  >
                    {lastAutoSaveAt ? formatTimestamp(lastAutoSaveAt) : '自动保存'}
                  </Badge>
                </Tooltip>
              ) : (
                <Tooltip label="自动保存已关闭">
                  <Badge size="xs" variant="light" color="red" leftSection={<IconCloudUpload size={10} />}>
                    未自动保存
                  </Badge>
                </Tooltip>
              )}
            </Group>
          </Group>
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
              智能评估
            </Tabs.Tab>
            <Tabs.Tab value="evidence" leftSection={<IconFileText size={16} />}>
              证据与报告
            </Tabs.Tab>
            <Tabs.Tab value="knowledgeBase" leftSection={<IconDatabase size={16} />}>
              知识库
            </Tabs.Tab>
            <Tabs.Tab value="smartCompare" leftSection={<IconFlask size={16} />}>
              智能比对
            </Tabs.Tab>
            <Tabs.Tab value="recommendation" leftSection={<IconBulb size={16} />}>
              智能推荐
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="editor">
            <Group grow align="stretch" style={{ height: 'calc(100vh - 180px)' }}>
              <Box style={{ width: 300, flexShrink: 0 }}>
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
              <Box style={{ width: 360, flexShrink: 0 }}>
                <Stack gap="md" style={{ height: '100%' }}>
                  <SchemeManager />
                  <MetricsPanel metrics={metrics} />
                  <EvidenceConflictAlert targetType="scheme" />
                </Stack>
              </Box>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="comparison">
            <Container size="xl" py="md">
              <SchemeComparison />
            </Container>
          </Tabs.Panel>

          <Tabs.Panel value="evidence">
            <Group grow align="stretch" style={{ height: 'calc(100vh - 180px)', gap: 'md' }}>
              <Box style={{ width: 380, flexShrink: 0 }}>
                <EvidenceAnnotationPanel />
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Stack gap="md" style={{ height: '100%' }}>
                  <Box style={{ height: 180, flexShrink: 0 }}>
                    <CollaborationPanel />
                  </Box>
                  <EvidenceConflictAlert targetType="scheme" />
                  <Box style={{ flex: 1, minHeight: 0 }}>
                    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
                      <Group justify="space-between" mb="md">
                        <Group gap="xs">
                          <IconTimeline size={18} color="#6366f1" />
                          <Text fw={600}>方案依据时间线</Text>
                        </Group>
                      </Group>
                      <ScrollArea h="calc(100% - 50px)">
                        <EvidenceTimeline />
                      </ScrollArea>
                    </Card>
                  </Box>
                </Stack>
              </Box>
              <Box style={{ width: 360, flexShrink: 0 }}>
                <ReportGenerator />
              </Box>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="knowledgeBase">
            <Container size="xl" py="md">
              <KnowledgeBaseBrowser />
            </Container>
          </Tabs.Panel>

          <Tabs.Panel value="smartCompare">
            <Container size="xl" py="md">
              <SmartComparisonPanel />
            </Container>
          </Tabs.Panel>

          <Tabs.Panel value="recommendation">
            <Container size="xl" py="md">
              <RecommendationPanel />
            </Container>
          </Tabs.Panel>
        </Tabs>
      </AppShell.Main>

      <Modal
        opened={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title="项目管理"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="项目名称"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="输入项目名称"
          />

          <Divider label="项目状态" labelPosition="center" />

          <Group grow>
            <Box style={{ textAlign: 'center', padding: 8 }}>
              <Text size="xl" fw={700} c="indigo">{sherds.length}</Text>
              <Text size="xs" c="dimmed">残片</Text>
            </Box>
            <Box style={{ textAlign: 'center', padding: 8 }}>
              <Text size="xl" fw={700} c="grape">{schemes.length}</Text>
              <Text size="xs" c="dimmed">方案</Text>
            </Box>
            <Box style={{ textAlign: 'center', padding: 8 }}>
              <Text size="xl" fw={700} c="green">{trustedSchemes}</Text>
              <Text size="xs" c="dimmed">可信方案</Text>
            </Box>
            <Box style={{ textAlign: 'center', padding: 8 }}>
              <Text size="xl" fw={700} c="blue">{totalKeyPoints}</Text>
              <Text size="xs" c="dimmed">关键点</Text>
            </Box>
            <Box style={{ textAlign: 'center', padding: 8 }}>
              <Text size="xl" fw={700} c="orange">{totalVersions}</Text>
              <Text size="xs" c="dimmed">历史版本</Text>
            </Box>
          </Group>

          <Divider label="项目元数据" labelPosition="center" />

          <TextInput
            label="遗址名称"
            placeholder="如：二里头遗址"
            value={metaForm.siteName || ''}
            onChange={(e) => setMetaForm({ ...metaForm, siteName: e.target.value })}
          />
          <Group grow>
            <TextInput
              label="考古学家"
              placeholder="负责人姓名"
              value={metaForm.archaeologist || ''}
              onChange={(e) => setMetaForm({ ...metaForm, archaeologist: e.target.value })}
            />
            <TextInput
              label="发掘日期"
              placeholder="如：2024-03"
              value={metaForm.excavationDate || ''}
              onChange={(e) => setMetaForm({ ...metaForm, excavationDate: e.target.value })}
            />
          </Group>
          <Textarea
            label="项目描述"
            placeholder="描述项目背景和复原目标..."
            minRows={2}
            value={metaForm.description || ''}
            onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })}
          />

          <Button
            variant="light"
            size="xs"
            onClick={() => setProjectMetadata(metaForm)}
          >
            保存元数据
          </Button>

          <Divider label="自动保存" labelPosition="center" />

          <Group justify="space-between">
            <Text size="sm">自动保存到浏览器本地存储</Text>
            <Group gap="xs">
              {autoSaveEnabled ? (
                <Badge size="sm" color="green" variant="light" leftSection={<IconCloudCheck size={12} />}>
                  已开启
                </Badge>
              ) : (
                <Badge size="sm" color="red" variant="light">已关闭</Badge>
              )}
              <Button
                size="xs"
                variant="light"
                onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              >
                {autoSaveEnabled ? '关闭' : '开启'}
              </Button>
            </Group>
          </Group>
          {lastAutoSaveAt && (
            <Text size="xs" c="dimmed">
              上次自动保存: {formatTimestamp(lastAutoSaveAt)}
            </Text>
          )}

          {projectError && (
            <Alert color="red" title="错误" icon={<IconTrashX size={16} />}>
              {projectError}
            </Alert>
          )}

          <Divider label="导入/导出" labelPosition="center" />

          <Group grow>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                setProjectMetadata(metaForm);
                saveProjectToFile(undefined, metaForm);
                setProjectModalOpen(false);
              }}
            >
              导出项目
            </Button>
            <FileButton onChange={handleLoadProject} accept=".json">
              {(props) => (
                <Button {...props} variant="light" leftSection={<IconUpload size={16} />}>
                  导入项目
                </Button>
              )}
            </FileButton>
          </Group>

          <Divider />

          <Button
            variant="light"
            color="red"
            leftSection={<IconTrashX size={16} />}
            onClick={() => setClearConfirmOpen(true)}
          >
            清空项目数据
          </Button>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setProjectModalOpen(false)}>
              关闭
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="确认清空"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">确定要清空所有残片和方案数据吗？此操作不可恢复。</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setClearConfirmOpen(false)}>取消</Button>
            <Button
              color="red"
              onClick={() => {
                clearProject();
                setClearConfirmOpen(false);
                setProjectModalOpen(false);
              }}
            >
              确认清空
            </Button>
          </Group>
        </Stack>
      </Modal>
    </AppShell>
  );
}

export default App;
