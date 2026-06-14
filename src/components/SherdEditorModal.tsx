import { Modal, Button, Group, TextInput, NumberInput, Stack, Text, FileButton, Image, Textarea, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useAppStore } from '@/store';
import { useEffect, useState, useRef } from 'react';
import { IconAlertCircle, IconUpload } from '@tabler/icons-react';
import type { SherdImage } from '@/types';

interface SherdEditorModalProps {
  opened: boolean;
  onClose: () => void;
  sherdId: string | null;
}

export function SherdEditorModal({ opened, onClose, sherdId }: SherdEditorModalProps) {
  const addSherd = useAppStore((s) => s.addSherd);
  const updateSherd = useAppStore((s) => s.updateSherd);
  const sherds = useAppStore((s) => s.sherds);
  const editingSherd = sherdId ? sherds.find((s) => s.id === sherdId) : null;

  const [imageData, setImageData] = useState<SherdImage | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const lastSherdIdRef = useRef<string | null>(null);

  const getInitialValues = () => {
    if (editingSherd) {
      return {
        sherdNumber: editingSherd.sherdNumber,
        scale: editingSherd.scale,
        thickness: editingSherd.thickness,
        patternPosition: editingSherd.patternPosition || '',
        notes: editingSherd.notes || '',
      };
    }
    return {
      sherdNumber: '',
      scale: 1,
      thickness: 5,
      patternPosition: '',
      notes: '',
    };
  };

  const form = useForm({
    mode: 'controlled',
    initialValues: getInitialValues(),
    validate: {
      sherdNumber: (value) => (!value.trim() ? '残片编号不能为空' : null),
      scale: (value) => (value <= 0 ? '比例尺必须大于零' : null),
      thickness: (value) => (value <= 0 ? '厚度必须大于零' : null),
    },
  });

  useEffect(() => {
    if (!opened) {
      initializedRef.current = false;
      return;
    }

    if (initializedRef.current && lastSherdIdRef.current === sherdId) {
      return;
    }

    initializedRef.current = true;
    lastSherdIdRef.current = sherdId;

    if (editingSherd) {
      queueMicrotask(() => {
        form.setValues({
          sherdNumber: editingSherd.sherdNumber,
          scale: editingSherd.scale,
          thickness: editingSherd.thickness,
          patternPosition: editingSherd.patternPosition || '',
          notes: editingSherd.notes || '',
        });
        setImageData(editingSherd.image);
      });
    } else {
      queueMicrotask(() => {
        form.reset();
        setImageData(null);
      });
    }
    setErrorMsg(null);
  }, [opened, sherdId, editingSherd, form]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        setImageData({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          dataUrl,
          width: img.width,
          height: img.height,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = form.onSubmit((values) => {
    setErrorMsg(null);
    if (!imageData && !editingSherd) {
      setErrorMsg('请上传残片图像');
      return;
    }

    if (editingSherd) {
      const result = updateSherd(editingSherd.id, {
        ...values,
        image: imageData || editingSherd.image,
      });
      if (!result.success) {
        setErrorMsg(result.error || '更新失败');
        return;
      }
    } else {
      const result = addSherd({
        ...values,
        image: imageData!,
        keyPoints: [],
      });
      if (!result.success) {
        setErrorMsg(result.error || '添加失败');
        return;
      }
    }
    onClose();
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editingSherd ? '编辑残片信息' : '导入新残片'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {errorMsg && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="错误">
              {errorMsg}
            </Alert>
          )}

          <Group align="flex-start" grow>
            <Stack gap="sm" style={{ flex: 1 }}>
              <TextInput
                label="残片编号"
                placeholder="如：SH-001"
                key={form.key('sherdNumber')}
                {...form.getInputProps('sherdNumber')}
              />
              <NumberInput
                label="比例尺 (像素/毫米)"
                placeholder="1 像素等于多少毫米"
                min={0.01}
                decimalScale={2}
                key={form.key('scale')}
                {...form.getInputProps('scale')}
              />
              <NumberInput
                label="厚度 (mm)"
                placeholder="残片平均厚度"
                min={0.1}
                decimalScale={1}
                key={form.key('thickness')}
                {...form.getInputProps('thickness')}
              />
              <TextInput
                label="纹饰位置"
                placeholder="如：口沿下 2cm 处"
                key={form.key('patternPosition')}
                {...form.getInputProps('patternPosition')}
              />
              <Textarea
                label="备注"
                placeholder="其他信息..."
                minRows={2}
                key={form.key('notes')}
                {...form.getInputProps('notes')}
              />
            </Stack>

            <Stack gap="sm" style={{ flex: 1 }}>
              <Text size="sm" fw={500}>残片图像</Text>
              {imageData ? (
                <Stack gap="sm">
                  <Image
                    src={imageData.dataUrl}
                    alt={imageData.name}
                    radius="md"
                    h={200}
                    fit="contain"
                    style={{ backgroundColor: '#f5f5f7' }}
                  />
                  <Text size="xs" c="dimmed">
                    {imageData.name} ({imageData.width} × {imageData.height}px)
                  </Text>
                  <FileButton onChange={handleFile} accept="image/*">
                    {(props) => <Button {...props} variant="light" size="sm">更换图像</Button>}
                  </FileButton>
                </Stack>
              ) : (
                <FileButton onChange={handleFile} accept="image/*">
                  {(props) => (
                    <Button
                      {...props}
                      variant="light"
                      h={200}
                      leftSection={<IconUpload size={24} />}
                      style={{ width: '100%' }}
                    >
                      点击上传残片图像
                    </Button>
                  )}
                </FileButton>
              )}
            </Stack>
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>取消</Button>
            <Button type="submit">{editingSherd ? '保存修改' : '导入残片'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
