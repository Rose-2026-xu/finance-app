import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, InputNumber, Input, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { companyAPI } from '../api';
import { onSSEEvent } from '../sse';
import { useMobile } from '../hooks/useMobile';
import type { Company } from '../types';

interface Props {
  user: any;
}

export default function Companies({ user }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form] = Form.useForm();
  const isMobile = useMobile();

  const canEdit = user.role === 'super_admin' || user.role === 'admin';

  const fetchData = useCallback(async () => {
    try {
      const res = await companyAPI.list();
      setCompanies(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const unsub = onSSEEvent('*', (event: any) => {
      if (event.type.startsWith('company_')) fetchData();
    });
    return unsub;
  }, [fetchData]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Company) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await companyAPI.delete(id);
      message.success('删除成功');
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await companyAPI.update(editing.id, values);
        message.success('更新成功');
      } else {
        await companyAPI.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.response?.data?.error) message.error(err.response.data.error);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '公司名称', dataIndex: 'name', key: 'name' },
    {
      title: '初始余额', dataIndex: 'initial_balance', key: 'initial_balance',
      render: (v: number) => <span>¥{(v || 0).toLocaleString()}</span>,
    },
    {
      title: '当前余额', dataIndex: 'balance', key: 'balance',
      render: (v: number) => (
        <Tag color={v >= 0 ? 'blue' : 'red'} style={{ fontSize: 14, padding: '2px 8px' }}>
          ¥{(v || 0).toLocaleString()}
        </Tag>
      ),
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    ...(canEdit ? [{
      title: '操作', key: 'action', width: 120,
      render: (_: any, record: Company) => (
        <span>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </span>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>公司管理</h2>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增公司
          </Button>
        )}
      </div>
      <Table
        columns={columns}
        dataSource={companies}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: 800 }}
      />

      <Modal
        title={editing ? '编辑公司' : '新增公司'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={isMobile ? '95vw' : undefined}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="公司名称" rules={[{ required: true, message: '请输入公司名称' }]}>
            <Input placeholder="请输入公司名称" />
          </Form.Item>
          <Form.Item name="initial_balance" label="初始银行余额" initialValue={0}>
            <InputNumber
              style={{ width: '100%' }}
              min={-999999999}
              precision={2}
              prefix="¥"
              placeholder="请输入初始余额"
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="可选，填写备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
