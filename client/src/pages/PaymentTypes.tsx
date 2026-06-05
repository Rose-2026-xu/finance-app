import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { paymentTypeAPI } from '../api';
import { onSSEEvent } from '../sse';
import { useMobile } from '../hooks/useMobile';
import type { PaymentType } from '../types';

interface Props {
  user: any;
}

const categoryOptions = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
  { value: 'other', label: '其他' },
];

const categoryLabels: Record<string, string> = {
  expense: '支出',
  income: '收入',
  other: '其他',
};

const categoryColors: Record<string, string> = {
  expense: 'volcano',
  income: 'green',
  other: 'default',
};

export default function PaymentTypes({ user }: Props) {
  const [types, setTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentType | null>(null);
  const [form] = Form.useForm();
  const isMobile = useMobile();

  const canEdit = user.role === 'super_admin' || user.role === 'admin';

  const fetchData = useCallback(async () => {
    try {
      const res = await paymentTypeAPI.list();
      setTypes(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const unsub = onSSEEvent('*', (event: any) => {
      if (event.type.startsWith('payment_type_')) fetchData();
    });
    return unsub;
  }, [fetchData]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: PaymentType) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleToggle = async (record: PaymentType) => {
    try {
      await paymentTypeAPI.update(record.id, { is_active: record.is_active ? 0 : 1 });
      message.success(record.is_active ? '已停用' : '已启用');
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await paymentTypeAPI.update(editing.id, values);
        message.success('更新成功');
      } else {
        await paymentTypeAPI.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.response?.data?.error) message.error(err.response.data.error);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newTypes = [...types];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newTypes.length) return;

    // Swap
    [newTypes[index], newTypes[targetIndex]] = [newTypes[targetIndex], newTypes[index]];

    // Build reorder payload
    const orders = newTypes.map((t, i) => ({ id: t.id, sort_order: i }));
    try {
      await paymentTypeAPI.reorder(orders);
      fetchData();
    } catch (err: any) {
      message.error('排序失败');
    }
  };

  const columns = [
    { title: '排序', key: 'sort', width: 80, render: (_: any, __: any, index: number) => (
      <Space size={0}>
        <Button type="text" icon={<ArrowUpOutlined />} size="small" disabled={index === 0} onClick={() => handleMove(index, 'up')} />
        <Button type="text" icon={<ArrowDownOutlined />} size="small" disabled={index === types.length - 1} onClick={() => handleMove(index, 'down')} />
      </Space>
    )},
    { title: '类型名称', dataIndex: 'name', key: 'name' },
    {
      title: '分类', dataIndex: 'category', key: 'category',
      render: (cat: string) => <Tag color={categoryColors[cat]}>{categoryLabels[cat] || cat}</Tag>,
    },
    {
      title: '状态', dataIndex: 'is_active', key: 'is_active',
      render: (v: number) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
    },
    ...(canEdit ? [{
      title: '操作', key: 'action', width: 120,
      render: (_: any, record: PaymentType) => (
        <span>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title={record.is_active ? '确定停用？' : '确定启用？'}
            onConfirm={() => handleToggle(record)}
          >
            <Button type="link" icon={<StopOutlined />} danger={record.is_active === 1} />
          </Popconfirm>
        </span>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>收支类型管理</h2>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增类型
          </Button>
        )}
      </div>
      <Table columns={columns} dataSource={types} rowKey="id" loading={loading} pagination={false} scroll={{ x: 600 }} />

      <Modal
        title={editing ? '编辑类型' : '新增类型'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="类型名称" rules={[{ required: true, message: '请输入类型名称' }]}>
            <Input placeholder="如：工资、房租" />
          </Form.Item>
          <Form.Item name="category" label="分类" initialValue="expense" rules={[{ required: true }]}>
            <Select options={categoryOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
