import { useState } from 'react';
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, Grid } from 'antd';
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
const { useBreakpoint } = Grid;

interface LayoutProps {
  user: User;
  onLogout: () => void;
}

const roleLabels: Record<string, string> = {
  super_admin: '超管',
  admin: '管理员',
  finance: '财务',
};

export default function Layout({ user, onLogout }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px

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

  // Bottom tab bar items for mobile
  const tabBarItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '首页' },
    { key: '/companies', icon: <BankOutlined />, label: '公司' },
    { key: '/payments', icon: <PayCircleOutlined />, label: '记录' },
    { key: '/receivables', icon: <SwapOutlined />, label: '应收' },
    { key: '/users', icon: <UserOutlined />, label: '我的' },
  ];

  const dropdownItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: onLogout,
    },
  ];

  // Mobile layout
  if (isMobile) {
    return (
      <AntLayout style={{ minHeight: '100vh' }}>
        {/* Minimal top bar */}
        <div style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: '#1a1a2e',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <span>财务管理</span>
          <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
            <Avatar icon={<UserOutlined />} size="small" style={{ background: '#1890ff', cursor: 'pointer' }} />
          </Dropdown>
        </div>

        {/* Content */}
        <Content style={{
          flex: 1,
          padding: 12,
          overflow: 'auto',
          paddingBottom: 60, // Space for tab bar
        }}>
          <Outlet />
        </Content>

        {/* Bottom Tab Bar */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}>
          {tabBarItems.map(item => {
            const isActive = location.pathname === item.key ||
              (item.key === '/users' && location.pathname === '/users');
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  cursor: 'pointer',
                  color: isActive ? '#1890ff' : '#8c8c8c',
                  fontSize: 10,
                  gap: 2,
                  padding: '4px 0',
                  transition: 'color 0.2s',
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </div>
            );
          })}
        </div>
      </AntLayout>
    );
  }

  // Desktop layout (unchanged)
  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        style={{ background: '#fff' }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0',
          fontWeight: 600,
          fontSize: collapsed ? 14 : 18,
          color: '#1a1a2e',
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
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ background: '#1890ff' }} />
              <span>{user.username}</span>
              <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                {roleLabels[user.role] || user.role}
              </span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{
          margin: 24,
          padding: 24,
          background: '#fff',
          borderRadius: 8,
          minHeight: 280,
          overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
