import { useState, useEffect } from 'react';
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

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

export default function Layout({ user, onLogout }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();
  const isMobile = useIsMobile();

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
      {/* Desktop: Fixed Sider */}
      {!isMobile && (
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
      )}

      <AntLayout>
        <Header style={{
          padding: isMobile ? '0 12px' : '0 24px',
          background: themeToken.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}>
          {!isMobile && (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
          )}
          {isMobile && (
            <span style={{ fontWeight: 600, fontSize: 16, color: themeToken.colorPrimary }}>
              财务管理系统
            </span>
          )}
          <Dropdown menu={{ items: dropdownItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ background: themeToken.colorPrimary }} />
              {!isMobile && (
                <>
                  <span>{user.username}</span>
                  <span style={{ color: themeToken.colorTextSecondary, fontSize: 12 }}>
                    {roleLabels[user.role] || user.role}
                  </span>
                </>
              )}
            </div>
          </Dropdown>
        </Header>
        <Content style={{
          margin: isMobile ? 8 : 24,
          padding: isMobile ? 10 : 24,
          background: themeToken.colorBgContainer,
          borderRadius: isMobile ? 8 : themeToken.borderRadiusLG,
          minHeight: 280,
          overflow: 'auto',
          // Leave space for bottom nav on mobile
          paddingBottom: isMobile ? 64 : 24,
        }}>
          <Outlet />
        </Content>
      </AntLayout>

      {/* Mobile: Bottom Tab Bar */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: themeToken.colorBgContainer,
          borderTop: `1px solid ${themeToken.colorBorderSecondary}`,
          display: 'flex',
          zIndex: 100,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}>
          {menuItems.map(item => {
            const isActive = location.pathname === item.key;
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  color: isActive ? themeToken.colorPrimary : themeToken.colorTextSecondary,
                  transition: 'color 0.2s',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </AntLayout>
  );
}
