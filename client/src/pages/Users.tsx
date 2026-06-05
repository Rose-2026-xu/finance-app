import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { userAPI, companyAPI } from '../api';
import type { User, Company } from '../types';

const roleOptions = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'admin', label: '管理员' },
  { value: 'finance', label: '财务人员' },
];

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  finance: '财务人员',
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    try {
      const res = await userAPI.list();
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    const res = await companyAPI.list();
    setCompanies(res.data);
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      company_ids: record.companies ? record.companies.map((c: any) => c.id) : [],
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await userAPI.delete(id);
      message.success('删除成功');
      fetchUsers();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await userAPI.update(editing.id, values);
        message.success('更新成功');
      } else {
        await userAPI.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      if (err.response?.data?.error) message.error(err.response.data.error);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    {
      title: '角色', dataIndex: 'role', key: 'role',
      render: (role: string) => roleLabels[role] || role,
    },
    {
      title: '绑定公司', key: 'companies',
      render: (_: any, record: any) => {
        if (record.companies && record.companies.length > 0) {
          return record.companies.map((c: any) => (
            <Tag key={c.id} color="blue">{c.name}</Tag>
          ));
        }
        return '-';
      },
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: any, record: User) => (
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
        <h2 style={{ margin: 0 }}>用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增用户
        </Button>
      </div>
      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} pagination={false} />

      <Modal
        title={editing ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? '新密码（留空不修改）' : '密码'}
            rules={editing ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editing ? '留空不修改' : '请输入密码'} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="company_ids" label="绑定公司（可多选）">
            <Select
              mode="multiple"
              allowClear
              placeholder="选择公司（可多选）"
              options={companies.map(c => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
