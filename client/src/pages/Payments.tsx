import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker,
  message, Popconfirm, Tag, Space, Upload, Alert, Divider, Tabs, Card, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined,
  UploadOutlined, UndoOutlined, ArrowUpOutlined, ArrowDownOutlined,
  PayCircleOutlined, AccountBookOutlined,
} from '@ant-design/icons';
import { companyAPI, paymentTypeAPI, paymentAPI } from '../api';
import { onSSEEvent } from '../sse';
import type { Company, PaymentType, Payment } from '../types';
import dayjs from 'dayjs';

interface Props {
  user: any;
}

export default function Payments({ user }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  const [filterCompany, setFilterCompany] = useState<number | undefined>();
  const [filterType, setFilterType] = useState<number | undefined>();
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | undefined>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [form] = Form.useForm();

  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);

  const canEdit = user.role === 'super_admin' || user.role === 'admin' || user.role === 'finance';

  const fetchPayments = useCallback(async () => {
    try {
      const params: any = { page, page_size: pageSize, direction: activeTab };
      if (filterCompany) params.company_id = filterCompany;
      if (filterType) params.type_id = filterType;
      if (filterDateRange) {
        params.date_from = filterDateRange[0].format('YYYY-MM-DD');
        params.date_to = filterDateRange[1].format('YYYY-MM-DD');
      }
      const res = await paymentAPI.list(params);
      setPayments(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeTab, filterCompany, filterType, filterDateRange]);

  const fetchMeta = useCallback(async () => {
    const [cRes, tRes] = await Promise.all([companyAPI.list(), paymentTypeAPI.list()]);
    setCompanies(cRes.data);
    setPaymentTypes(tRes.data.filter((t: PaymentType) => t.is_active));
  }, []);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  useEffect(() => {
    fetchPayments();
    const unsub = onSSEEvent('*', (event: any) => {
      if (event.type.startsWith('payment_') || event.type.startsWith('payments_')) {
        fetchPayments();
        fetchMeta();
      }
    });
    return unsub;
  }, [fetchPayments, fetchMeta]);

  const [modalDirection, setModalDirection] = useState<string>('expense');

  const handleAdd = (defaultDirection?: string) => {
    setEditing(null);
    form.resetFields();
    const dir = defaultDirection || 'expense';
    setModalDirection(dir);
    if (user.role === 'finance' && user.company_id) {
      form.setFieldsValue({ company_id: user.company_id });
    }
    form.setFieldsValue({ direction: dir });
    setModalOpen(true);
  };

  const handleEdit = (record: Payment) => {
    setEditing(record);
    setModalDirection(record.direction);
    form.setFieldsValue({ ...record, payment_date: dayjs(record.payment_date) });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await paymentAPI.delete(id);
      message.success('删除成功');
      fetchPayments();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = { ...values, payment_date: values.payment_date.format('YYYY-MM-DD') };
      if (editing) {
        await paymentAPI.update(editing.id, data);
        message.success('更新成功');
      } else {
        await paymentAPI.create(data);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchPayments();
    } catch (err: any) {
      if (err.response?.data?.error) message.error(err.response.data.error);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await paymentAPI.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      message.error('下载模板失败');
    }
  };

  const handleImport = async (file: File) => {
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await paymentAPI.importFile(file);
      setImportResult(res.data);
      if (res.data.success > 0) {
        message.success(`成功导入 ${res.data.success} 条记录`);
        fetchPayments();
      }
    } catch (err: any) {
      message.error(err.response?.data?.error || '导入失败');
    } finally {
      setImportLoading(false);
    }
    return false;
  };

  const handleUndoBatch = async (batchId: string) => {
    try {
      await paymentAPI.undoBatch(batchId);
      message.success('撤销成功');
      setImportResult(null);
      fetchPayments();
    } catch (err: any) {
      message.error(err.response?.data?.error || '撤销失败');
    }
  };

  const isIncome = activeTab === 'income';

  // Calculate total amount for current page
  const totalAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + Number(p.amount), 0);
  }, [payments]);

  // Per-company subtotals
  const companyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach(p => {
      const name = p.company_name || '未知';
      map[name] = (map[name] || 0) + Number(p.amount);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [payments]);

  const columns = [
    {
      title: '日期', dataIndex: 'payment_date', key: 'date', width: 120,
      render: (v: string) => <span style={{ color: '#1a1a2e', fontWeight: 600, fontSize: 15 }}>{v}</span>,
    },
    {
      title: '公司', dataIndex: 'company_name', key: 'company', width: 150,
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: 15 }}>{v}</span>,
    },
    {
      title: '类型', dataIndex: 'type_name', key: 'type', width: 110,
      render: (text: string) => (
        <Tag style={{
          borderRadius: 4,
          fontWeight: 600,
          fontSize: 14,
          border: 'none',
          background: isIncome ? 'rgba(82,196,26,0.1)' : 'rgba(255,77,79,0.1)',
          color: isIncome ? '#389e0d' : '#cf1322',
        }}>{text}</Tag>
      ),
    },
    {
      title: '金额', dataIndex: 'amount', key: 'amount', width: 160,
      render: (amount: number) => (
        <span style={{
          color: isIncome ? '#389e0d' : '#cf1322',
          fontWeight: 700,
          fontSize: 16,
          fontFamily: '"DIN Alternate", "Roboto Mono", monospace',
        }}>
          {isIncome ? '+' : '-'}¥{Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true,
      render: (v: string) => <span style={{ color: '#595959', fontSize: 15 }}>{v || '-'}</span>,
    },
    ...(canEdit ? [{
      title: '操作', key: 'action', width: 90,
      render: (_: any, record: Payment) => (
        <Space size={0}>
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}
            style={{ color: '#1890ff' }} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  const activeTypes = paymentTypes.filter(t =>
    t.is_active && (isIncome ? t.category === 'income' : t.category === 'expense')
  );

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AccountBookOutlined style={{ fontSize: 24, color: '#1a1a2e' }} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>收支记录</h2>
        </div>
        <Space wrap size={8}>
          {canEdit && (
            <>
              <Button
                icon={<ArrowDownOutlined />}
                onClick={() => handleAdd('expense')}
                style={{
                  background: 'linear-gradient(135deg, #ff4d4f, #ff7875)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: 6,
                  boxShadow: '0 2px 6px rgba(255,77,79,0.3)',
                }}
              >
                新增支出
              </Button>
              <Button
                icon={<ArrowUpOutlined />}
                onClick={() => handleAdd('income')}
                style={{
                  background: 'linear-gradient(135deg, #52c41a, #73d13d)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: 6,
                  boxShadow: '0 2px 6px rgba(82,196,26,0.3)',
                }}
              >
                新增收入
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => { setImportOpen(true); setImportResult(null); }}
                style={{ borderRadius: 6, fontWeight: 500 }}
              >
                导入
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            style={{
              borderRadius: 10,
              border: 'none',
              background: isIncome
                ? 'linear-gradient(135deg, #f6ffed, #d9f7be)'
                : 'linear-gradient(135deg, #fff1f0, #ffccc7)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500, marginBottom: 4 }}>
                  {isIncome ? '合计收入' : '合计支出'}
                </div>
                <div style={{
                  fontSize: 32,
                  fontWeight: 800,
                  fontFamily: '"DIN Alternate", "Roboto Mono", monospace',
                  color: isIncome ? '#389e0d' : '#cf1322',
                  lineHeight: 1.2,
                }}>
                  ¥{totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <PayCircleOutlined style={{
                fontSize: 40,
                color: isIncome ? 'rgba(82,196,26,0.2)' : 'rgba(255,77,79,0.2)',
              }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            size="small"
            style={{
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #f0f5ff, #d6e4ff)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <div style={{ fontSize: 14, color: '#8c8c8c', fontWeight: 600, marginBottom: 8 }}>各公司汇总</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {companyTotals.length > 0 ? companyTotals.map(([name, amount]) => (
                <Tag key={name} style={{
                  margin: 0,
                  padding: '5px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'rgba(24,144,255,0.08)',
                  color: '#1a1a2e',
                  fontWeight: 600,
                  fontSize: 16,
                  fontFamily: '"DIN Alternate", "Roboto Mono", system-ui',
                }}>
                  {name}: ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </Tag>
              )) : <span style={{ color: '#bfbfbf' }}>暂无数据</span>}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as any); setPage(1); setLoading(true); setTotal(0); setPayments([]); }}
        style={{ marginBottom: 4 }}
        items={[
          {
            key: 'expense',
            label: (
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                <ArrowDownOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                支出记录
              </span>
            ),
          },
          {
            key: 'income',
            label: (
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                <ArrowUpOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                收入记录
              </span>
            ),
          },
        ]}
      />

      {/* Filters */}
      <div style={{
        marginBottom: 16,
        padding: '12px 16px',
        background: '#fafafa',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
      }}>
        <Space wrap size={8}>
          <Select
            placeholder="筛选公司"
            allowClear
            style={{ width: 160 }}
            value={filterCompany}
            onChange={setFilterCompany}
            options={companies.map(c => ({ value: c.id, label: c.name }))}
          />
          <Select
            placeholder="筛选类型"
            allowClear
            style={{ width: 140 }}
            value={filterType}
            onChange={setFilterType}
            options={activeTypes.map(t => ({ value: t.id, label: t.name }))}
          />
          <DatePicker.RangePicker
            value={filterDateRange}
            onChange={(dates) => setFilterDateRange(dates as any)}
            style={{ borderRadius: 6 }}
          />
        </Space>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={payments}
        rowKey="id"
        loading={loading}
        scroll={{ x: 700 }}
        style={{
          borderRadius: 8,
          overflow: 'hidden',
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{
              background: isIncome ? '#f6ffed' : '#fff1f0',
            }}>
              <Table.Summary.Cell index={0} colSpan={3}
                style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}
              >
                <span style={{ fontWeight: 700, color: '#1a1a2e', fontSize: 14 }}>
                  合计
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3}>
                <span style={{
                  fontWeight: 800,
                  fontSize: 15,
                  fontFamily: '"DIN Alternate", "Roboto Mono", monospace',
                  color: isIncome ? '#389e0d' : '#cf1322',
                }}>
                  ¥{totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} colSpan={canEdit ? 2 : 1} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* Add/Edit Modal */}
      <Modal
        title={editing ? '编辑记录' : `新增${form.getFieldValue('direction') === 'income' ? '收入' : '支出'}记录`}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="company_id" label="公司" rules={[{ required: true, message: '请选择公司' }]}>
            <Select
              options={companies.map(c => ({ value: c.id, label: c.name }))}
              disabled={user.role === 'finance'}
            />
          </Form.Item>
          <Form.Item name="type_id" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={paymentTypes.filter(t => t.is_active && t.category === modalDirection).map(t => ({ value: t.id, label: t.name }))}
              placeholder={`请选择${modalDirection === 'income' ? '收入' : '支出'}类型`}
            />
          </Form.Item>
          <Form.Item name="direction" label="方向" rules={[{ required: true }]} initialValue="expense">
            <Select
              options={[{ value: 'income', label: '收入' }, { value: 'expense', label: '支出' }]}
              onChange={(v) => { setModalDirection(v); form.setFieldsValue({ type_id: undefined }); }}
            />
          </Form.Item>
          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0.01} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item name="payment_date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="导入记录"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={null}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载导入模板
          </Button>
          <Upload
            accept=".xlsx,.xls,.csv"
            showUploadList={false}
            beforeUpload={handleImport}
            customRequest={() => {}}
          >
            <Button type="primary" icon={<UploadOutlined />} loading={importLoading}>
              选择文件上传
            </Button>
          </Upload>
          {importResult && (
            <>
              <Divider />
              <Alert
                type={importResult.errors.length > 0 ? 'warning' : 'success'}
                message={`导入完成：成功 ${importResult.success} 条${
                  importResult.errors.length > 0 ? `，失败 ${importResult.errors.length} 条` : ''
                }`}
                showIcon
              />
              {importResult.errors.length > 0 && (
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {importResult.errors.map((e: any, i: number) => (
                    <div key={i} style={{ color: '#ff4d4f', fontSize: 12 }}>
                      第{e.row}行: {e.error}
                    </div>
                  ))}
                </div>
              )}
              {importResult.success > 0 && importResult.batch_id && (
                <Popconfirm title="确定撤销此批导入？" onConfirm={() => handleUndoBatch(importResult.batch_id)}>
                  <Button danger icon={<UndoOutlined />}>撤销整批导入</Button>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      </Modal>
    </div>
  );
}
