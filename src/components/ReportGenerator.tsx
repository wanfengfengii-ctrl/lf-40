import { useAppStore } from '@/store';
import {
  Card,
  Button,
  Group,
  Text,
  Badge,
  Stack,
  Modal,
  Select,
  ScrollArea,
  Divider,
  Table,
  Textarea,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconFileReport,
  IconDownload,
  IconFileText,
  IconBrandHtml5,
  IconBraces,
  IconFile,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import type { ReportFormat, ReconstructionReport } from '@/types';

interface ReportGeneratorProps {
  schemeId?: string | null;
  compact?: boolean;
}

const FORMAT_OPTIONS: { value: ReportFormat; label: string; icon: any }[] = [
  { value: 'html', label: 'HTML 报告', icon: IconBrandHtml5 },
  { value: 'pdf', label: 'PDF 报告', icon: IconFileText },
  { value: 'word', label: 'Word 文档', icon: IconFile },
  { value: 'markdown', label: 'Markdown', icon: IconFileText },
  { value: 'json', label: 'JSON 数据', icon: IconBraces },
  { value: 'txt', label: '纯文本', icon: IconFile },
];

export function ReportGenerator({ schemeId, compact = false }: ReportGeneratorProps) {
  const schemes = useAppStore((s) => s.schemes);
  const generateReport = useAppStore((s) => s.generateReport);
  const downloadReport = useAppStore((s) => s.downloadReport);
  const generatedReports = useAppStore((s) => s.generatedReports);
  const setSchemeReconstructionBasis = useAppStore((s) => s.setSchemeReconstructionBasis);
  const activeSchemeId = useAppStore((s) => s.activeSchemeId);
  const getSchemeEvidence = useAppStore((s) => s.getSchemeEvidence);

  const currentSchemeId = schemeId || activeSchemeId;
  const currentScheme = schemes.find((s) => s.id === currentSchemeId) || null;
  const schemeEvidence = currentSchemeId ? getSchemeEvidence(currentSchemeId) : null;

  const [modalOpen, setModalOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<ReconstructionReport | null>(null);

  const form = useForm({
    mode: 'controlled',
    initialValues: {
      schemeId: currentSchemeId || '',
      format: 'html' as ReportFormat,
      reconstructionBasis: schemeEvidence?.reconstructionBasis || '',
    },
  });

  const schemeReports = useMemo(
    () => generatedReports.filter((r) => !currentSchemeId || r.schemeId === currentSchemeId),
    [generatedReports, currentSchemeId]
  );

  const handleGenerate = form.onSubmit((values) => {
    if (!values.schemeId) return;
    if (values.reconstructionBasis) {
      setSchemeReconstructionBasis(values.schemeId, values.reconstructionBasis);
    }
    const report = generateReport(values.schemeId, values.format);
    setPreviewReport(report);
    setModalOpen(false);
  });

  const handleGenerateAndDownload = () => {
    const values = form.getValues();
    if (!values.schemeId) return;
    if (values.reconstructionBasis) {
      setSchemeReconstructionBasis(values.schemeId, values.reconstructionBasis);
    }
    const report = generateReport(values.schemeId, values.format);
    downloadReport(report);
    setModalOpen(false);
  };

  const formatIcon = (fmt: ReportFormat) => {
    const opt = FORMAT_OPTIONS.find((o) => o.value === fmt);
    if (!opt) return null;
    const Icon = opt.icon;
    return <Icon size={14} />;
  };

  if (compact) {
    return (
      <Group gap={4}>
        <Tooltip label="生成考古报告">
          <ActionIcon
            variant="subtle"
            size="sm"
            color="indigo"
            onClick={() => {
              if (currentSchemeId) {
                form.setFieldValue('schemeId', currentSchemeId);
                form.setFieldValue('reconstructionBasis', getSchemeEvidence(currentSchemeId)?.reconstructionBasis || '');
              }
              setModalOpen(true);
            }}
          >
            <IconFileReport size={16} />
          </ActionIcon>
        </Tooltip>
        {schemeReports.length > 0 && (
          <Tooltip label={`已生成 ${schemeReports.length} 份报告`}>
            <Badge size="xs" color="indigo" variant="light">
              {schemeReports.length} 报告
            </Badge>
          </Tooltip>
        )}
      </Group>
    );
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder h="100%">
      <Stack gap="sm" h="100%">
        <Group justify="space-between">
          <Group gap="xs">
            <Text fw={600} size="lg">考古复原报告</Text>
          </Group>
          <Button
            size="sm"
            leftSection={<IconFileReport size={14} />}
            onClick={() => {
              if (currentSchemeId) {
                form.setFieldValue('schemeId', currentSchemeId);
                form.setFieldValue('reconstructionBasis', getSchemeEvidence(currentSchemeId)?.reconstructionBasis || '');
              }
              setModalOpen(true);
            }}
            disabled={!currentScheme}
          >
            生成报告
          </Button>
        </Group>

        {!currentScheme && (
          <Text size="sm" c="dimmed" ta="center" py="md">
            请先选择或创建一个复原方案
          </Text>
        )}

        {previewReport && (
          <AlertWithReport report={previewReport} onDownload={() => downloadReport(previewReport)} onClose={() => setPreviewReport(null)} />
        )}

        <Divider my={0} />

        <Group justify="space-between">
          <Text fw={500} size="sm">
            历史报告
          </Text>
          <Badge size="xs" color="gray" variant="light">
            {schemeReports.length} 份
          </Badge>
        </Group>

        <ScrollArea h={200}>
          {schemeReports.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="md">
              暂无已生成的报告
            </Text>
          ) : (
            <Stack gap="xs">
              {schemeReports
                .slice()
                .sort((a, b) => b.generatedAt - a.generatedAt)
                .map((report) => (
                  <Card key={report.id} withBorder padding="xs" radius="sm">
                    <Group justify="space-between">
                      <Group gap="xs">
                        {formatIcon(report.format)}
                        <div>
                          <Text size="xs" fw={500} lineClamp={1}>
                            {report.schemeName}
                          </Text>
                          <Text size="10" c="dimmed">
                            {new Date(report.generatedAt).toLocaleString('zh-CN')} · {report.generatedBy}
                          </Text>
                        </div>
                      </Group>
                      <Group gap={4}>
                        <Tooltip label="预览">
                          <ActionIcon size="xs" variant="subtle" onClick={() => setPreviewReport(report)}>
                            <IconFileText size={12} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="下载">
                          <ActionIcon size="xs" variant="subtle" onClick={() => downloadReport(report)}>
                            <IconDownload size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                    <Group gap={4} mt="xs" wrap="wrap">
                      <Badge size="xs" color="indigo" variant="light">
                        {report.metadata.sherdCount} 残片
                      </Badge>
                      <Badge size="xs" color="blue" variant="light">
                        {report.metadata.chronologyCount} 年代
                      </Badge>
                      <Badge size="xs" color="orange" variant="light">
                        {report.metadata.stratigraphyCount} 地层
                      </Badge>
                      <Badge size="xs" color="violet" variant="light">
                        {report.metadata.expertOpinionCount} 意见
                      </Badge>
                    </Group>
                  </Card>
                ))}
            </Stack>
          )}
        </ScrollArea>
      </Stack>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="生成考古复原报告"
        size="lg"
      >
        <form onSubmit={handleGenerate}>
          <Stack gap="md">
            <Select
              label="选择复原方案"
              placeholder="选择要生成报告的方案"
              data={schemes.map((s) => ({ value: s.id, label: `${s.name}${s.isTrusted ? ' (可信)' : ''}` }))}
              searchable
              key={form.key('schemeId')}
              {...form.getInputProps('schemeId')}
            />
            <Select
              label="报告格式"
              data={FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              key={form.key('format')}
              {...form.getInputProps('format')}
            />
            <Textarea
              label="复原依据（可选）"
              placeholder="描述该复原方案的综合依据和思路..."
              minRows={3}
              key={form.key('reconstructionBasis')}
              {...form.getInputProps('reconstructionBasis')}
            />

            <Divider label="报告将包含" labelPosition="center" />

            <Text size="xs" c="dimmed">
              ✓ 项目与方案基本信息<br />
              ✓ 轮廓图与尺寸数据（口径、器高、底径、壁厚）<br />
              ✓ 匹配度评分与各维度贡献分析<br />
              ✓ 断裂点说明与间隙距离<br />
              ✓ 残片明细（厚度、关键点、纹饰等）<br />
              ✓ 证据链摘要（年代判断、地层信息、参考器物、专家意见）<br />
              ✓ 证据冲突提示（如有）
            </Text>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="submit" variant="light" leftSection={<IconFileText size={14} />}>
                生成并预览
              </Button>
              <Button onClick={handleGenerateAndDownload} leftSection={<IconDownload size={14} />}>
                生成并下载
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}

function AlertWithReport({
  report,
  onDownload,
  onClose,
}: {
  report: ReconstructionReport;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      opened
      onClose={onClose}
      title={`报告预览 - ${report.schemeName}`}
      size="xl"
    >
      <Stack gap="md">
        <Group gap="xs" wrap="wrap">
          <Badge size="xs" color="indigo" variant="light">
            {report.format.toUpperCase()}
          </Badge>
          <Text size="xs" c="dimmed">
            生成于 {new Date(report.generatedAt).toLocaleString('zh-CN')}
          </Text>
          <Text size="xs" c="dimmed">
            由 {report.generatedBy} 生成
          </Text>
        </Group>

        <Divider />

        <Table withTableBorder={false}>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>残片数量</Table.Td>
              <Table.Td>{report.metadata.sherdCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>证据来源</Table.Td>
              <Table.Td>{report.metadata.evidenceCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>年代判断</Table.Td>
              <Table.Td>{report.metadata.chronologyCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>地层信息</Table.Td>
              <Table.Td>{report.metadata.stratigraphyCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>参考器物</Table.Td>
              <Table.Td>{report.metadata.referenceCount}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>专家意见</Table.Td>
              <Table.Td>{report.metadata.expertOpinionCount}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>

        {(report.format === 'html' || report.format === 'pdf' || report.format === 'word') && (
          <div
            style={{
              maxHeight: 300,
              overflow: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 12,
              backgroundColor: '#fafafa',
            }}
            dangerouslySetInnerHTML={{ __html: report.content }}
          />
        )}

        {report.format !== 'html' && report.format !== 'pdf' && report.format !== 'word' && (
          <ScrollArea h={300}>
            <Text
              size="xs"
              style={{
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {report.content}
            </Text>
          </ScrollArea>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>关闭</Button>
          <Button leftSection={<IconDownload size={14} />} onClick={onDownload}>
            下载报告
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
