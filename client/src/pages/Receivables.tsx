import { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
  message, Popconfirm, Tag, Space, Tabs,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { receivableAPI, companyAPI } from '../api';
import { onSSEEvent } from '../sse';
import type { Receivable, Company } from '../types';

const statusLabels: Record<string, string> = {
  pending: '未结算',
  partial: '部分结算',
  settled: '已结算',
};

const statusColors: Record<string, string> = {
  pending: 'volcano',
  partial: 'orange',
  settled: 'green',
};

export default function Receivables() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Receivable | null>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    try {
      const res = await receivableAPI.list({ direction: activeTab });
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchCompanies = useCallback(async () => {
    const res = await companyAPI.list();
    setCompanies(res.data);
  }, []);

  useEffect(() => {
    fetchData();
    fetchCompanies();
  }, [fetchData, fetchCompanies]);

  useEffect(() => {
    const unsub = onSSEEvent('*', (event: any) => {
      if (event.type.startsWith('receivable_')) fetchData();
    });
    return unsub;
  }, [fetchData]);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ direction: activeTab });
    setModalOpen(true);
  };

  const handleEdit = (record: Receivable) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      due_date: record.due_date ? dayjs(record.due_date) : undefined,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await receivableAPI.delete(id);
      message.success('删除成功');
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
        amount: parseFloat(values.amount),
        settled_amount: values.settled_amount ? parseFloat(values.settled_amount) : 0,
      };
      if (editing) {
        await receivableAPI.update(editing.id, data);
        message.success('更新成功');
      } else {
        await receivableAPI.create(data);
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
    { title: '公司', dataIndex: 'company_name', key: 'company', width: 130 },
    { title: '对方单位', dataIndex: 'counterparty', key: 'counterparty', width: 130 },
    {
      title: '总金额(元)', dataIndex: 'amount', key: 'amount', width: 120,
      render: (v: number) => <span style={{ fontWeight: 600 }}>¥{Number(v).toLocaleString()}</span>,
    },
    {
      title: '已结算(元)', dataIndex: 'settled_amount', key: 'settled', width: 120,
      render: (v: number) => <span style={{ color: '#52c41a' }}>¥{Number(v).toLocaleString()}</span>,
    },
    {
      title: '未结算(元)', key: 'unsettled', width: 120,
      render: (_: any, record: Receivable) => {
        const remaining = record.amount - record.settled_amount;
        return <span style={{ color: remaining > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>¥{Number(remaining).toLocaleString()}</span>;
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    { title: '到期日', dataIndex: 'due_date', key: 'due_date', width: 110, render: (v: string) => v || '-' },
    { title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, record: Receivable) => (
        <span>
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>应收应付管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增{activeTab === 'receivable' ? '应收' : '应付'}
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as any); setLoading(true); }}
        items={[
          { key: 'receivable', label: '应收款项' },
          { key: 'payable', label: '应付款项' },
        ]}
      />

      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
      />

      <Modal
        title={editing ? '编辑' : `新增${activeTab === 'receivable' ? '应收' : '应付'}`}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="company_id" label="公司" rules={[{ required: true, message: '请选择公司' }]}>
            <Select options={companies.map(c => ({ value: c.id, label: c.name }))} />
          </Form.Item>
          <Form.Item name="direction" label="类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'receivable', label: '应收（别人欠我）' },
                { value: 'payable', label: '应付（我欠别人）' },
              ]}
            />
          </Form.Item>
          <Form.Item name="counterparty" label="对方单位" rules={[{ required: true, message: '请输入对方单位' }]}>
            <Input placeholder="请输入对方单位名称" />
          </Form.Item>
          <Form.Item name="amount" label="金额(元)" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="settled_amount" label="已结算金额(元)" initialValue={0}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="due_date" label="到期日">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="pending">
            <Select
              options={[
                { value: 'pending', label: '未结算' },
                { value: 'partial', label: '部分结算' },
                { value: 'settled', label: '已结算' },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import dayjs from 'dayjs';
