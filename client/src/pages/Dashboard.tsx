import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Select, DatePicker, Space, Divider } from 'antd';
import {
  BankOutlined,
  PayCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { dashboardAPI } from '../api';
import { onSSEEvent } from '../sse';
import { useMobile } from '../hooks/useMobile';
import type { CompanySummary, Payment, ReceivableSummary } from '../types';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

dayjs.extend(isoWeek);
dayjs.extend(quarterOfYear);

function toWan(amount: number): string {
  return (amount / 10000).toFixed(2);
}

// Color palette for company remarks
const remarkColors = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96', '#13c2c2', '#fa541c', '#2f54eb'];

interface Props {
  user: any;
}

export default function Dashboard({ user }: Props) {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receivables, setReceivables] = useState<ReceivableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'month' | 'week' | 'custom'>('month');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | undefined>();
  const isMobile = useMobile();

  const getDateRange = useCallback((): { date_from?: string; date_to?: string } => {
    if (filterMode === 'month') {
      const now = dayjs();
      return { date_from: now.startOf('month').format('YYYY-MM-DD'), date_to: now.endOf('month').format('YYYY-MM-DD') };
    } else if (filterMode === 'week') {
      const now = dayjs();
      return { date_from: now.startOf('isoWeek').format('YYYY-MM-DD'), date_to: now.endOf('isoWeek').format('YYYY-MM-DD') };
    } else if (customRange) {
      return { date_from: customRange[0].format('YYYY-MM-DD'), date_to: customRange[1].format('YYYY-MM-DD') };
    }
    return {};
  }, [filterMode, customRange]);

  const fetchData = useCallback(async () => {
    try {
      const params = getDateRange();
      const res = await dashboardAPI.get(params);
      setCompanies(res.data.companies || []);
      setPayments(res.data.recent_payments || []);
      setReceivables(res.data.receivables || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    fetchData();
    const unsub = onSSEEvent('*', (event: any) => {
      if (event.type !== 'heartbeat' && event.type !== 'connected') fetchData();
    });
    return unsub;
  }, [fetchData]);

  const now = dayjs();
  const filterLabel = filterMode === 'month'
    ? `${now.format('YYYY年M月')}`
    : filterMode === 'week'
      ? `${now.startOf('isoWeek').format('M月D日')}-${now.endOf('isoWeek').format('M月D日')}`
      : '自定义';

  // Split payments into income and expense
  const expensePayments = payments.filter(p => p.direction === 'expense');
  const incomePayments = payments.filter(p => p.direction === 'income');

  const paymentColumns = (direction: 'income' | 'expense') => [
    { title: '日期', dataIndex: 'payment_date', key: 'date', width: 110 },
    { title: '公司', dataIndex: 'company_name', key: 'company', width: 120 },
    {
      title: '类型', dataIndex: 'type_name', key: 'type', width: 100,
      render: (text: string) => <Tag color={direction === 'income' ? 'green' : 'red'}>{text}</Tag>,
    },
    {
      title: '金额(万元)', dataIndex: 'amount', key: 'amount', width: 120,
      render: (amount: number) => (
        <span style={{ color: direction === 'income' ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {direction === 'income' ? '+' : '-'}{toWan(amount)}
        </span>
      ),
    },
    { title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true },
  ];

  return (
    <div>
      {/* Date filter */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>仪表盘</h2>
        <Select
          value={filterMode}
          onChange={(v) => { setFilterMode(v); if (v !== 'custom') setCustomRange(undefined); }}
          style={{ width: 120 }}
          options={[
            { value: 'month', label: '本月' },
            { value: 'week', label: '本周' },
            { value: 'custom', label: '自定义' },
          ]}
        />
        {filterMode === 'custom' && (
          <DatePicker.RangePicker value={customRange} onChange={(dates) => setCustomRange(dates as any)} />
        )}
        <span style={{ color: '#000', fontWeight: 600 }}>当前查看: {filterLabel}</span>
      </div>

      {/* Per-company cards */}
      <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} style={{ marginBottom: 24 }}>
        {companies.map((c, idx) => {
          const rec = receivables.find(r => r.company_id === c.company_id);
          const remarkColor = remarkColors[idx % remarkColors.length];
          return (
            <Col xs={24} md={12} xl={8} key={c.company_id}>
              <Card
                title={<><BankOutlined /> {c.company_name}</>}
                size="small"
                extra={c.remark ? <span style={{ fontSize: 12, fontWeight: 600, color: remarkColor }}>{c.remark}</span> : null}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="银行余额"
                      value={parseFloat(toWan(c.balance))}
                      precision={2}
                      suffix="万元"
                      valueStyle={{ color: c.balance >= 0 ? '#1890ff' : '#ff4d4f', fontSize: isMobile ? 16 : 20 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title={`${filterLabel}净额`}
                      value={parseFloat(toWan(c.net))}
                      precision={2}
                      suffix="万元"
                      valueStyle={{ color: c.net >= 0 ? '#52c41a' : '#ff4d4f', fontSize: isMobile ? 16 : 20 }}
                    />
                  </Col>
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title={`${filterLabel}收入`}
                      value={parseFloat(toWan(c.income))}
                      precision={2}
                      suffix="万元"
                      prefix={<ArrowUpOutlined />}
                      valueStyle={{ color: '#52c41a', fontSize: isMobile ? 14 : 16 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title={`${filterLabel}支出`}
                      value={parseFloat(toWan(c.expense))}
                      precision={2}
                      suffix="万元"
                      prefix={<ArrowDownOutlined />}
                      valueStyle={{ color: '#ff4d4f', fontSize: isMobile ? 14 : 16 }}
                    />
                  </Col>
                </Row>
                {(rec && (rec.receivable_unsettled > 0 || rec.payable_unsettled > 0)) && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic
                          title="应收未收"
                          value={parseFloat(toWan(rec.receivable_unsettled))}
                          precision={2}
                          suffix="万元"
                          valueStyle={{ color: '#faad14', fontSize: 14 }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="应付未付"
                          value={parseFloat(toWan(rec.payable_unsettled))}
                          precision={2}
                          suffix="万元"
                          valueStyle={{ color: '#ff7a45', fontSize: 14 }}
                        />
                      </Col>
                    </Row>
                  </>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Income records */}
      <Card
        title={<><ArrowUpOutlined style={{ color: '#52c41a' }} /> 收入记录（{filterLabel}）</>}
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={paymentColumns('income')}
          dataSource={incomePayments}
          rowKey="id"
          pagination={{ pageSize: 5, showTotal: (t) => `共 ${t} 条` }}
          size="small"
          scroll={{ x: 700 }}
          locale={{ emptyText: `${filterLabel}暂无收入记录` }}
        />
      </Card>

      {/* Expense records */}
      <Card title={<><ArrowDownOutlined style={{ color: '#ff4d4f' }} /> 支出记录（{filterLabel}）</>}>
        <Table
          columns={paymentColumns('expense')}
          dataSource={expensePayments}
          rowKey="id"
          pagination={{ pageSize: 5, showTotal: (t) => `共 ${t} 条` }}
          size="small"
          scroll={{ x: 700 }}
          locale={{ emptyText: `${filterLabel}暂无支出记录` }}
        />
      </Card>
    </div>
  );
}
