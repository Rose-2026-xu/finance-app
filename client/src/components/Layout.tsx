import { useState } from 'react';
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, theme } from 'antd';
import {
  DashboardOutlined,
  BankOutlined,
  TagsOutlined,
  PayCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import type { User } from '../types';

const { Header, Sider, Content } = AntLayout;

interface LayoutProps {
  user: User;
  onLogout: () => void;
}

const roleLabels: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  finance: '财务人员',
};

export default function Layout({ user, onLogout }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/companies', icon: <BankOutlined />, label: '公司管理' },
    { key: '/payment-types', icon: <TagsOutlined />, label: '收支类型' },
    { key: '/payments', icon: <PayCircleOutlined />, label: '收支记录' },
    { key: '/receivables', icon: <SwapOutlined />, label: '应收应付' },
    ...(user.role === 'super_admin'
      ? [{ key: '/users', icon: <UserOutlined />, label: '用户管理' }]
      : []),
  ];

  const dropdownItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: themeToken.colorBgContainer }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          fontWeight: 600,
          fontSize: collapsed ? 14 : 18,
          color: themeToken.colorPrimary,
        }}>
          {collapsed ? '财务' : '财务管理系统'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none' }}
        />
      </Sider>
      <AntLayout>
        <Header style={{
          padding: '0 24px',
          background: themeToken.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ background: themeToken.colorPrimary }} />
              <span>{user.username}</span>
              <span style={{ color: themeToken.colorTextSecondary, fontSize: 12 }}>
                {roleLabels[user.role] || user.role}
              </span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{
          margin: 24,
          padding: 24,
          background: themeToken.colorBgContainer,
          borderRadius: themeToken.borderRadiusLG,
          minHeight: 280,
          overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
