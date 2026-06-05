import { useState } from 'react';
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, Drawer, theme } from 'antd';
import {
  DashboardOutlined,
  BankOutlined,
  TagsOutlined,
  PayCircleOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  SwapOutlined,
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();
  const isMobile = useMobile();

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

  const handleMenuClick = (key: string) => {
    navigate(key);
    if (isMobile) setDrawerOpen(false);
  };

  const menuContent = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
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

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* Mobile: Drawer sidebar */}
      {isMobile ? (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={220}
          bodyStyle={{ padding: 0 }}
          title={null}
          closable={false}
        >
          {logoContent(false)}
          {menuContent}
        </Drawer>
      ) : (
        /* Desktop: Sider */
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          style={{ background: themeToken.colorBgContainer }}
        >
          {logoContent(collapsed)}
          {menuContent}
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
          {isMobile ? (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
          ) : (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
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
          margin: isMobile ? 12 : 24,
          padding: isMobile ? 12 : 24,
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
