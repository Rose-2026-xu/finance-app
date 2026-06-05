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
  SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMobile } from '../hooks/useMobile';
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
  const isMobile = useMobile();

  // All menu items (used for desktop sidebar)
  const allMenuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/companies', icon: <BankOutlined />, label: '公司管理' },
    { key: '/payment-types', icon: <TagsOutlined />, label: '收支类型' },
    { key: '/payments', icon: <PayCircleOutlined />, label: '收支记录' },
    { key: '/receivables', icon: <SwapOutlined />, label: '应收应付' },
    ...(user.role === 'super_admin'
      ? [{ key: '/users', icon: <UserOutlined />, label: '用户管理' }]
      : []),
  ];

  // Mobile bottom tabs: main 4 items always visible, rest in "更多" dropdown
  const mainTabs = allMenuItems.slice(0, 4);
  const moreItems = allMenuItems.slice(4);

  const dropdownItems = [
    ...moreItems.map(item => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    })),
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  // Desktop sidebar menu
  const sidebarMenu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={allMenuItems}
      onClick={({ key }) => handleMenuClick(key)}
      style={{ borderRight: 'none' }}
    />
  );

  const logoContent = (compact: boolean) => (
    <div style={{
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
      fontWeight: 600,
      fontSize: compact ? 14 : 18,
      color: themeToken.colorPrimary,
    }}>
      {compact ? '财务' : '财务管理系统'}
    </div>
  );

  // Determine if "更多" tab should be highlighted
  const moreKeys = moreItems.map(i => i.key);
  const isMoreActive = moreKeys.includes(location.pathname);

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* Desktop: Sider */}
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          style={{ background: themeToken.colorBgContainer }}
        >
          {logoContent(collapsed)}
          {sidebarMenu}
        </Sider>
      )}

      <AntLayout style={{ paddingBottom: isMobile ? 56 : 0 }}>
        <Header style={{
          padding: isMobile ? '0 12px' : '0 24px',
          background: themeToken.colorBgContainer,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
          height: 48,
          lineHeight: '48px',
        }}>
          {isMobile ? (
            <span style={{ fontWeight: 700, fontSize: 16, color: themeToken.colorPrimary }}>
              财务管理系统
            </span>
          ) : (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
          )}
          <Dropdown menu={{ items: isMobile ? [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }] : [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录' }] }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: themeToken.colorPrimary }} />
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
          borderRadius: themeToken.borderRadiusLG,
          minHeight: 280,
          overflow: 'auto',
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
          background: '#fff',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          zIndex: 100,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        }}>
          {mainTabs.map(item => {
            const isActive = location.pathname === item.key;
            return (
              <div
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  color: isActive ? themeToken.colorPrimary : '#999',
                  transition: 'color 0.2s',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
              </div>
            );
          })}
          {/* "更多" tab for extra items (users, etc.) */}
          {moreItems.length > 0 && (
            <Dropdown
              menu={{ items: dropdownItems, onClick: ({ key }) => {
                if (key === 'logout') { onLogout(); return; }
                handleMenuClick(key);
              }}}
              placement="topRight"
              trigger={['click']}
            >
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                cursor: 'pointer',
                color: isMoreActive ? themeToken.colorPrimary : '#999',
                userSelect: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ fontSize: 20 }}><SettingOutlined /></span>
                <span style={{ fontSize: 10, fontWeight: isMoreActive ? 600 : 400 }}>更多</span>
              </div>
            </Dropdown>
          )}
        </div>
      )}
    </AntLayout>
  );
}
