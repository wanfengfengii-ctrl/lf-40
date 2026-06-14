import { useAppStore } from '@/store';
import { Card, Button, Group, Text, Badge, Stack, ScrollArea, ActionIcon, Tooltip, Modal, FileButton, Alert, TextInput, Progress, Divider, Table } from '@mantine/core';
import { IconPlus, IconTrash, IconEdit, IconUpload, IconDownload, IconFolderOpen, IconFiles, IconTrashX, IconCheck, IconX, IconPhoto, IconAlertCircle } from '@tabler/icons-react';
import { useState, useRef, useCallback } from 'react';
import { SherdEditorModal } from './SherdEditorModal';

interface FileImportStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'duplicate' | 'failed';
  sherdNumber?: string;
  reason?: string;
  existingSherdNumber?: string;
}

export function SherdList() {
  const sherds = useAppStore((s) => s.sherds);
  const activeSherdId = useAppStore((s) => s.activeSherdId);
  const setActiveSherd = useAppStore((s) => s.setActiveSherd);
  const removeSherd = useAppStore((s) => s.removeSherd);
  const batchImportSherds = useAppStore((s) => s.batchImportSherds);
  const saveProjectToFile = useAppStore((s) => s.saveProjectToFile);
  const loadProjectFromFile = useAppStore((s) => s.loadProjectFromFile);
  const setProjectName = useAppStore((s) => s.setProjectName);
  const projectName = useAppStore((s) => s.projectName);
  const clearProject = useAppStore((s) => s.clearProject);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSherdId, setEditingSherdId] = useState<string | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<{ loading: boolean; progress: number; message: string }>({ loading: false, progress: 0, message: '' });
  const [importResult, setImportResult] = useState<{ success: number; duplicates: number; failed: number } | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [modalDragOver, setModalDragOver] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileImportStatus[]>([]);
  const dropRef = useRef<HTMLDivElement>(null);

  const processBatchImport = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setImportStatus({ loading: true, progress: 0, message: `正在处理 ${files.length} 个文件...` });
    setImportResult(null);

    const statuses: FileImportStatus[] = files.map((f) => ({
      file: f,
      status: 'pending' as const,
    }));
    setFileStatuses(statuses);

    try {
      const result = await batchImportSherds(files);

      const duplicateFiles = new Map(result.duplicates.map((d) => [d.file.name, d.reason]));
      const failedFiles = new Map(result.failed.map((f) => [f.file.name, f.reason]));

      const updatedStatuses: FileImportStatus[] = files.map((f) => {
        const dupReason = duplicateFiles.get(f.name);
        const failReason = failedFiles.get(f.name);
        const successSherd = result.successful.find((s) => s.image.name === f.name);

        if (successSherd) {
          return { file: f, status: 'success', sherdNumber: successSherd.sherdNumber };
        } else if (dupReason) {
          return { file: f, status: 'duplicate', reason: dupReason };
        } else if (failReason) {
          return { file: f, status: 'failed', reason: failReason };
        }
        return { file: f, status: 'pending' };
      });

      setFileStatuses(updatedStatuses);
      setImportStatus({ loading: false, progress: 100, message: '导入完成' });
      setImportResult({
        success: result.successful.length,
        duplicates: result.duplicates.length,
        failed: result.failed.length,
      });
    } catch (e) {
      setImportStatus({ loading: false, progress: 0, message: `导入失败: ${e instanceof Error ? e.message : String(e)}` });
    }
  }, [batchImportSherds]);

  const handleBatchImport = async (files: File[] | null) => {
    if (!files || files.length === 0) return;
    await processBatchImport(files);
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );

    if (files.length > 0) {
      if (!batchModalOpen) {
        setFileStatuses([]);
        setImportResult(null);
        setImportStatus({ loading: false, progress: 0, message: '' });
        setBatchModalOpen(true);
      }
      await processBatchImport(files);
    }
  }, [batchModalOpen, processBatchImport]);

  const handleModalDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalDragOver(true);
  }, []);

  const handleModalDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalDragOver(false);
  }, []);

  const handleModalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setModalDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length > 0) {
      await processBatchImport(files);
    }
  }, [processBatchImport]);

  const statusIcon = (status: FileImportStatus['status']) => {
    switch (status) {
      case 'success':
        return <IconCheck size={14} color="#22c55e" />;
      case 'duplicate':
        return <IconAlertCircle size={14} color="#eab308" />;
      case 'failed':
        return <IconX size={14} color="#ef4444" />;
      case 'processing':
        return <IconPhoto size={14} color="#3b82f6" />;
      default:
        return <IconPhoto size={14} color="#9ca3af" />;
    }
  };

  const statusLabel = (status: FileImportStatus['status']) => {
    switch (status) {
      case 'success':
        return <Badge size="xs" color="green" variant="light">成功</Badge>;
      case 'duplicate':
        return <Badge size="xs" color="yellow" variant="light">重复</Badge>;
      case 'failed':
        return <Badge size="xs" color="red" variant="light">失败</Badge>;
      case 'processing':
        return <Badge size="xs" color="blue" variant="light">处理中</Badge>;
      default:
        return <Badge size="xs" color="gray" variant="light">等待</Badge>;
    }
  };

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Text fw={600} size="lg">残片管理</Text>
          <Group gap={4}>
            <Tooltip label="项目管理">
              <ActionIcon size="sm" variant="subtle" onClick={() => setProjectModalOpen(true)}>
                <IconFolderOpen size={16} />
              </ActionIcon>
            </Tooltip>
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
        </Group>

        <Group grow>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconFiles size={14} />}
            onClick={() => {
              setImportResult(null);
              setFileStatuses([]);
              setImportStatus({ loading: false, progress: 0, message: '' });
              setBatchModalOpen(true);
            }}
          >
            批量导入
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconDownload size={14} />}
            onClick={() => saveProjectToFile()}
          >
            保存项目
          </Button>
        </Group>

        <Divider my={0} />

        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            borderRadius: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <ScrollArea h="100%">
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
                          {sherd.patternPosition && ` | 纹饰: ${sherd.patternPosition}`}
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

          {isDragOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '2px dashed var(--mantine-color-indigo-5)',
                borderRadius: 8,
                zIndex: 10,
                pointerEvents: 'none',
              }}
            >
              <IconUpload size={32} color="var(--mantine-color-indigo-5)" />
              <Text fw={600} c="indigo" mt="xs">释放以批量导入残片</Text>
              <Text size="xs" c="dimmed">支持拖放多个图像文件</Text>
            </div>
          )}
        </div>
      </Stack>

      <SherdEditorModal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        sherdId={editingSherdId}
      />

      <Modal
        opened={batchModalOpen}
        onClose={() => !importStatus.loading && setBatchModalOpen(false)}
        title="批量导入残片"
        size="lg"
      >
        <Stack gap="md">
          {importStatus.loading && (
            <Stack gap="xs">
              <Text size="sm" c="dimmed">{importStatus.message}</Text>
              <Progress value={importStatus.progress} animated />
            </Stack>
          )}
          {!importStatus.loading && (
            <>
              <div
                onDragOver={handleModalDragOver}
                onDragLeave={handleModalDragLeave}
                onDrop={handleModalDrop}
                style={{
                  border: modalDragOver
                    ? '2px dashed var(--mantine-color-indigo-5)'
                    : '2px dashed var(--mantine-color-gray-4)',
                  borderRadius: 8,
                  padding: 20,
                  textAlign: 'center',
                  backgroundColor: modalDragOver
                    ? 'rgba(99, 102, 241, 0.05)'
                    : 'transparent',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
              >
                <IconUpload size={28} color={modalDragOver ? 'var(--mantine-color-indigo-5)' : '#9ca3af'} />
                <Text size="sm" fw={500} mt="xs" c={modalDragOver ? 'indigo' : 'dimmed'}>
                  {modalDragOver ? '释放以导入' : '拖放图像文件到此处'}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  或点击下方按钮选择文件，支持多选
                </Text>
              </div>
              <FileButton
                onChange={handleBatchImport}
                accept="image/*"
                multiple
                disabled={importStatus.loading}
              >
                {(props) => (
                  <Button
                    {...props}
                    variant="light"
                    fullWidth
                    leftSection={<IconUpload size={16} />}
                  >
                    点击选择多个残片图像文件
                  </Button>
                )}
              </FileButton>
            </>
          )}

          {fileStatuses.length > 0 && (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" fw={600}>导入详情</Text>
                {importResult && (
                  <Group gap="xs">
                    <Badge color="green" leftSection={<IconCheck size={10} />}>成功: {importResult.success}</Badge>
                    <Badge color="yellow" leftSection={<IconAlertCircle size={10} />}>重复: {importResult.duplicates}</Badge>
                    <Badge color="red" leftSection={<IconX size={10} />}>失败: {importResult.failed}</Badge>
                  </Group>
                )}
              </Group>
              <ScrollArea h={200}>
                <Table withTableBorder={false} highlightOnHover>
                  <Table.Tbody>
                    {fileStatuses.map((fs, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>
                          <Group gap="xs">
                            {statusIcon(fs.status)}
                            <Text size="xs" fw={500} lineClamp={1} maw={150}>
                              {fs.file.name}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {fs.sherdNumber && (
                            <Text size="xs" c="dimmed">{fs.sherdNumber}</Text>
                          )}
                        </Table.Td>
                        <Table.Td>{statusLabel(fs.status)}</Table.Td>
                        <Table.Td>
                          {fs.reason && (
                            <Tooltip label={fs.reason}>
                              <Text size="xs" c="dimmed" lineClamp={1} maw={120}>
                                {fs.reason}
                              </Text>
                            </Tooltip>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
              <Text size="xs" c="dimmed">
                重复残片会自动检测并跳过，基于图像感知哈希和残片编号进行校验。
              </Text>
            </Stack>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBatchModalOpen(false)} disabled={importStatus.loading}>
              关闭
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title="项目管理"
        size="md"
      >
        <Stack gap="md">
          <TextInput
            label="项目名称"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="输入项目名称"
          />
          {projectError && (
            <Alert color="red" title="错误" icon={<IconTrashX size={16} />}>
              {projectError}
            </Alert>
          )}
          <Group grow>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                saveProjectToFile();
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
    </Card>
  );
}
