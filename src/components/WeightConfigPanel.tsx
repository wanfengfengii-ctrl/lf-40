import { Card, Text, Stack, Group, Slider, Button, Divider, Tooltip, Badge, Alert } from '@mantine/core';
import { IconTarget, IconLayers, IconFlower2, IconCheck, IconRefresh, IconRestore } from '@tabler/icons-react';
import { useAppStore } from '@/store';
import { DEFAULT_WEIGHT_CONFIG } from '@/utils/reconstruction';
import type { MetricsWeightConfig } from '@/types';

export function WeightConfigPanel() {
  const weightConfig = useAppStore((s) => s.weightConfig);
  const setWeightConfig = useAppStore((s) => s.setWeightConfig);
  const schemes = useAppStore((s) => s.schemes);

  const totalWeight = weightConfig.contourWeight + weightConfig.thicknessWeight + weightConfig.patternWeight;
  const isValid = Math.abs(totalWeight - 1) < 0.01;

  const handleChange = (key: keyof MetricsWeightConfig, value: number) => {
    setWeightConfig({ [key]: value });
  };

  const handleReset = () => {
    setWeightConfig(DEFAULT_WEIGHT_CONFIG);
  };

  const autoNormalize = (changedKey: keyof MetricsWeightConfig, newValue: number) => {
    const others = (['contourWeight', 'thicknessWeight', 'patternWeight'] as const).filter(k => k !== changedKey);
    const remaining = 1 - newValue;
    const otherSum = others.reduce((acc, k) => acc + weightConfig[k], 0);
    const updates: Partial<MetricsWeightConfig> = { [changedKey]: newValue };

    if (otherSum > 0 && remaining > 0) {
      others.forEach(k => {
        updates[k] = Number((remaining * (weightConfig[k] / otherSum)).toFixed(4));
      });
    } else if (otherSum === 0) {
      const each = Number((remaining / others.length).toFixed(4));
      others.forEach(k => {
        updates[k] = each;
      });
    }

    setWeightConfig(updates);
  };

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600} size="lg">权重配置</Text>
          <Group gap="xs">
            <Badge
              size="sm"
              variant="light"
              color={isValid ? 'green' : 'red'}
            >
              总和: {(totalWeight * 100).toFixed(0)}%
            </Badge>
            <Tooltip label="恢复默认权重">
              <Button size="xs" variant="subtle" onClick={handleReset} leftSection={<IconRestore size={12} />}>
                重置
              </Button>
            </Tooltip>
          </Group>
        </Group>

        {!isValid && (
          <Alert color="red" title="权重总和不等于 100%" p="xs">
            请调整权重使其总和为 100%，当前总和为 {(totalWeight * 100).toFixed(0)}%
          </Alert>
        )}

        <Stack gap="md">
          <Stack gap="xs">
            <Group justify="space-between">
              <Group gap="xs">
                <IconTarget size={16} color="#3b82f6" />
                <Text size="sm" fw={500}>轮廓匹配权重</Text>
              </Group>
              <Group gap={4}>
                <Text size="sm" fw={700}>{(weightConfig.contourWeight * 100).toFixed(0)}%</Text>
                <Tooltip label="轮廓拟合优度对综合匹配度的贡献比例">
                  <Badge size="xs" variant="light" color="blue">轮廓</Badge>
                </Tooltip>
              </Group>
            </Group>
            <Slider
              value={weightConfig.contourWeight * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => autoNormalize('contourWeight', v / 100)}
              label={(v) => `${v}%`}
              marks={[{ value: 0, label: '0%' }, { value: 55, label: '55%' }, { value: 100, label: '100%' }]}
              color="blue"
            />
            <Text size="xs" c="dimmed">基于关键点圆弧拟合的轮廓匹配质量</Text>
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Group gap="xs">
                <IconLayers size={16} color="#a855f7" />
                <Text size="sm" fw={500}>厚度一致性权重</Text>
              </Group>
              <Group gap={4}>
                <Text size="sm" fw={700}>{(weightConfig.thicknessWeight * 100).toFixed(0)}%</Text>
                <Tooltip label="残片厚度变异系数对综合匹配度的贡献比例">
                  <Badge size="xs" variant="light" color="grape">厚度</Badge>
                </Tooltip>
              </Group>
            </Group>
            <Slider
              value={weightConfig.thicknessWeight * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => autoNormalize('thicknessWeight', v / 100)}
              label={(v) => `${v}%`}
              marks={[{ value: 0, label: '0%' }, { value: 20, label: '20%' }, { value: 100, label: '100%' }]}
              color="grape"
            />
            <Text size="xs" c="dimmed">残片间厚度一致性越高，越可能来自同一器物</Text>
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between">
              <Group gap="xs">
                <IconFlower2 size={16} color="#f97316" />
                <Text size="sm" fw={500}>纹饰对齐权重</Text>
              </Group>
              <Group gap={4}>
                <Text size="sm" fw={700}>{(weightConfig.patternWeight * 100).toFixed(0)}%</Text>
                <Tooltip label="纹饰点关于中心轴的对称程度对综合匹配度的贡献比例">
                  <Badge size="xs" variant="light" color="orange">纹饰</Badge>
                </Tooltip>
              </Group>
            </Group>
            <Slider
              value={weightConfig.patternWeight * 100}
              min={0}
              max={100}
              step={1}
              onChange={(v) => autoNormalize('patternWeight', v / 100)}
              label={(v) => `${v}%`}
              marks={[{ value: 0, label: '0%' }, { value: 25, label: '25%' }, { value: 100, label: '100%' }]}
              color="orange"
            />
            <Text size="xs" c="dimmed">纹饰点关于中心轴的对称性评估</Text>
          </Stack>
        </Stack>

        <Divider label="附加配置" labelPosition="center" />

        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconCheck size={16} color="#22c55e" />
              <Text size="sm" fw={500}>可信复原加成</Text>
            </Group>
            <Text size="sm" fw={700}>+{weightConfig.trustedBonus}</Text>
          </Group>
          <Slider
            value={weightConfig.trustedBonus}
            min={0}
            max={30}
            step={1}
            onChange={(v) => handleChange('trustedBonus', v)}
            label={(v) => `+${v}`}
            marks={[{ value: 0, label: '0' }, { value: 10, label: '10' }, { value: 30, label: '30' }]}
            color="green"
          />
          <Text size="xs" c="dimmed">标记为可信复原时的额外得分加成</Text>
        </Stack>

        <Stack gap="xs">
          <Group justify="space-between">
            <Group gap="xs">
              <IconRefresh size={16} color="#6366f1" />
              <Text size="sm" fw={500}>残片数量加成</Text>
            </Group>
            <Text size="sm" fw={700}>+{weightConfig.sherdCountBonus}</Text>
          </Group>
          <Slider
            value={weightConfig.sherdCountBonus}
            min={0}
            max={10}
            step={0.5}
            onChange={(v) => handleChange('sherdCountBonus', v)}
            label={(v) => `+${v}`}
            marks={[{ value: 0, label: '0' }, { value: 2, label: '2' }, { value: 10, label: '10' }]}
            color="indigo"
          />
          <Text size="xs" c="dimmed">每使用一个残片获得的额外得分</Text>
        </Stack>

        {schemes.length > 0 && (
          <>
            <Divider />
            <Alert color="blue" variant="light" p="xs">
              <Text size="xs">调整权重后，所有方案的匹配度评分将立即重新计算并刷新。</Text>
            </Alert>
          </>
        )}
      </Stack>
    </Card>
  );
}
