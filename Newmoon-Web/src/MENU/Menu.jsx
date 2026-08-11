import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Badge, Modal, Avatar, Button, Space, Tooltip } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  CalendarOutlined,
  PullRequestOutlined,
  RiseOutlined,
  EnvironmentOutlined,
  BranchesOutlined,
  TruckOutlined,
  BoxPlotOutlined,
  TransactionOutlined,
  DatabaseOutlined,
  DollarOutlined,
  InboxOutlined,
  MoneyCollectOutlined,
  AuditOutlined,
  BellOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { api } from "../config/api";
import logo from "../assets/logooos.jpg";

const { Sider } = Layout;

function MenuSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [openKeys, setOpenKeys] = useState([]);
  const [notificationPanelVisible, setNotificationPanelVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = localStorage.getItem("role") || "admin";

  // FoodMeal Colors
  const colors = {
    primary: "#f22626db",
    secondary: "#1A237E",
    accent: "#1565C0",
    lightBlue: "#E3F2FD",
    lightRed: "#FFEBEE",
    gradient: "linear-gradient(135deg, #ee0606, #2006e9)",
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebarCollapsed", JSON.stringify(next));
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
    setLogoutModalVisible(false);
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.unread_count);
    } catch { }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications', { params: { per_page: 10 } });
      setNotifications(res.data.data || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { }
  };

  // Map paths to parent group keys for openKeys
  const pathToGroupKey = {
    "/inventory": "products-group",
    "/cash-advance": "products-group",
    "/supply-requests": "products-group",
    "/pullout-admin": "products-group",
    "/back-to-sales": "products-group",
    "/staff": "staff-group",
    "/staff-performance": "staff-group",
    "/branch-map": "branch-group",
    "/branch-assign": "branch-group",
  };

  // Initialize openKeys based on current path
  useEffect(() => {
    const groupKey = pathToGroupKey[location.pathname];
    if (groupKey) {
      setOpenKeys((prev) => prev.includes(groupKey) ? prev : [...prev, groupKey]);
    }
  }, [location.pathname]);

  const menuItems = [
    { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
    {
      key: "products-group",
      icon: <BoxPlotOutlined />,
      label: "Product & Inventory",
      children: [
        { key: "/inventory", icon: <DatabaseOutlined />, label: "Products & Stock Levels" },
        { key: "/cash-advance", icon: <DollarOutlined />, label: "Cash Advance" },
        { key: "/supply-requests", icon: <InboxOutlined />, label: "Supply Request" },
        { key: "/pullout-admin", icon: <PullRequestOutlined />, label: "Pull-out Items" },
        { key: "/back-to-sales", icon: <ArrowLeftOutlined />, label: "Back-to-Sales" },
      ],
    },
    { key: "/attendance", icon: <DatabaseOutlined />, label: "Attendance" },
    { key: "/sales", icon: <TransactionOutlined />, label: "Sales Transactions" },
    { key: "/customers", icon: <TeamOutlined />, label: "Customer Data" },
    { key: "/reservations", icon: <CalendarOutlined />, label: "Reservation Data" },
    {
      key: "staff-group",
      icon: <MoneyCollectOutlined />,
      label: "Staff Data",
      children: [
        { key: "/staff", icon: <UserOutlined />, label: "Staff Management" },
        { key: "/staff-performance", icon: <RiseOutlined />, label: "Staff Performance" },
      ],
    },
    { key: "/delivery", icon: <TruckOutlined />, label: "Delivery Data" },
    {
      key: "branch-group",
      icon: <BranchesOutlined />,
      label: "Branch Data",
      children: [
        { key: "/branch-map", icon: <EnvironmentOutlined />, label: "Branch Information" },
        { key: "/branch-assign", icon: <AuditOutlined />, label: "Branch Assignments" },
      ],
    },
    { key: "/reports", icon: <FileTextOutlined />, label: "Reports" },
  ];

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={toggleCollapsed}
      trigger={null}
      width={270}
      theme="light"
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        borderRight: "2px solid #2d96e1",
        background: "linear-gradient(to bottom, #fafafd, #FFEBEE, #E3F2FD)",
        boxShadow: "4px 0 20px rgba(26,35,126,0.08)",
        overflow: "hidden", // Prevent overflow on the sider itself
      }}
    >
      {/* Collapse Toggle */}
      <div className="absolute top-3 right-[-14px] z-10">
        <Tooltip title={collapsed ? "Expand" : "Collapse"}>
          <Button
            shape="circle"
            size="small"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapsed}
            className="bg-white border-2 border-[#E53935] text-[#E53935] shadow-[0_2px_12px_rgba(229,57,53,0.3)] font-bold hover:scale-105 transition-transform duration-200"
          />
        </Tooltip>
      </div>

      {/* Logo - Fixed Height */}
      <div
        onClick={() => navigate("/dashboard")}
        className={`flex flex-col items-center cursor-pointer flex-shrink-0 ${collapsed ? 'py-5 px-2' : 'pt-7 pb-5 px-4'} border-b-2 border-[#E3F2FD] bg-gradient-to-b from-[#E3F2FD] to-transparent`}
      >
        <div
          className={`${collapsed ? 'w-12 h-12' : 'w-16 h-16'} rounded-2xl overflow-hidden bg-gradient-to-br from-[#E53935] to-[#1A237E] flex items-center justify-center shadow-[0_6px_20px_rgba(229,57,53,0.4)] border-2 border-white transition-all duration-300 hover:scale-105`}
        >
          {!logoError ? (
            <img
              src={logo}
              alt="Logo"
              className="w-full h-full object-cover"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="text-white font-bold text-xl">NM</span>
          )}
        </div>
        {!collapsed && (
          <div className="mt-2.5 text-center">
            <div className="font-extrabold text-base tracking-[1.5px] uppercase text-[#1A237E]">
              <span className="text-[#E53935]">New</span>Moon
            </div>
            <div className="text-[10px] tracking-[2px] font-medium text-[#1A237E] opacity-70">
              LECHON MANOK
            </div>
          </div>
        )}
      </div>

      {/* User Info - Fixed Height */}
      {!collapsed && user && (
        <div className="px-5 py-4 border-b-2 border-[#E3F2FD] bg-gradient-to-r from-[#E3F2FD]/50 to-[#FFEBEE]/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar
              size={44}
              icon={<UserOutlined />}
              className="bg-gradient-to-br from-[#E53935] to-[#1A237E] border-2 border-white shadow-[0_2px_10px_rgba(229,57,53,0.3)]"
            />
            <div className="leading-[1.4]">
              <div className="font-bold text-[15px] tracking-[0.5px] text-[#1A237E]">
                Hey, {user.name || user.username || "User"}
              </div>
              <div className="text-[11px] capitalize font-medium text-[#E53935] bg-[#E53935]/10 px-2.5 py-0.5 rounded-full inline-block">
                {userRole === "admin" ? "Administrator" : "Staff"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Bell - Fixed Height */}
      {!collapsed && (
        <div className="px-4 py-2 relative border-b-2 border-[#E3F2FD] flex-shrink-0">
          <Button
            type="text"
            block
            className="text-left px-3 py-2 h-auto rounded-xl bg-white/60 border border-[#E3F2FD] hover:bg-[#FFEBEE] transition-colors duration-200"
            onClick={() => {
              setNotificationPanelVisible(!notificationPanelVisible);
              if (!notificationPanelVisible) fetchNotifications();
            }}
          >
            <Space>
              <Badge count={unreadCount} size="small" offset={[-4, 4]}>
                <BellOutlined className="text-[18px] text-[#1A237E]" />
              </Badge>
              <span className="text-[13px] font-medium text-[#1A237E]">Notifications</span>
            </Space>
          </Button>

          {notificationPanelVisible && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotificationPanelVisible(false)}
              />
              <div
                className="absolute left-4 right-4 top-full z-50 bg-white border-2 border-[#E3F2FD] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] max-h-[380px] flex flex-col"
              >
                <div className="flex justify-between items-center px-4 py-3 border-b-2 border-[#E3F2FD] bg-gradient-to-r from-[#E3F2FD]/30 to-[#FFEBEE]/30">
                  <span className="font-bold text-[14px] text-[#1A237E]">Notifications</span>
                  {unreadCount > 0 && (
                    <Button
                      type="link"
                      size="small"
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] text-[#E53935] font-semibold"
                    >
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="overflow-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-[30px] text-center text-[12px] text-[#999]">
                      <BellOutlined className="text-[28px] mb-2.5 block text-[#1A237E]" />
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                        className={`px-4 py-3 cursor-pointer border-b border-[#f5f5f5] ${!n.is_read ? 'bg-[#FFEBEE]' : 'bg-transparent'} hover:bg-[#fafafa] transition-colors duration-200`}
                      >
                        <div className="flex gap-2 items-start">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${!n.is_read ? 'bg-[#E53935]' : 'bg-transparent'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] leading-[1.4] text-[#333]">{n.message}</div>
                            <div className="text-[10px] mt-0.5 text-[#999]">
                              {new Date(n.created_at).toLocaleString()}
                            </div>
                          </div>
                          {n.type === "stock_not_received" && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FFEBEE] text-[#E53935] font-semibold flex-shrink-0">
                              Stock
                            </span>
                          )}
                          {n.type === "low_stock" && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#E3F2FD] text-[#1A237E] font-semibold flex-shrink-0">
                              Low Stock
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Navigation Menu - Takes remaining space */}
      <div
        className="sidebar-menu-scroll"
        style={{
          flex: 1,
          minHeight: 0, // Important for flex scrolling
          overflowY: "auto",
          overflowX: "hidden",
          paddingBottom: "8px",
        }}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={(keys) => setOpenKeys(keys)}
          onClick={({ key }) => navigate(key)}
          items={menuItems}
          className="foodmeal-menu"
        />
      </div>

      {/* Bottom Actions - Fixed at bottom */}
      <div className="border-t-2 border-[#E3F2FD] bg-gradient-to-r from-[#E3F2FD]/20 to-[#FFEBEE]/20 px-4 py-3 flex-shrink-0">
        <Space orientation="vertical" className="w-full" size={8}>
          {collapsed ? (
            <Tooltip title="Logout">
              <Button
                danger
                type="text"
                icon={<LogoutOutlined />}
                onClick={() => setLogoutModalVisible(true)}
                className="w-full rounded-xl h-10"
              />
            </Tooltip>
          ) : (
            <Button
              icon={<LogoutOutlined />}
              onClick={() => setLogoutModalVisible(true)}
              block
              className="rounded-xl h-10 bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white font-semibold border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90 hover:-translate-y-0.5 transition-all duration-300"
            >
              Logout
            </Button>
          )}
        </Space>
      </div>

      {/* Logout Confirmation Modal */}
      <Modal
        title={<span className="text-[#E53935]"><LogoutOutlined className="mr-2" />Confirm Logout</span>}
        open={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onOk={handleLogout}
        okText="Yes, Logout"
        okButtonProps={{
          danger: true,
          className: "bg-[#E53935] border-[#E53935] rounded-lg"
        }}
        cancelText="Cancel"
        cancelButtonProps={{
          className: "rounded-lg border-[#1A237E] text-[#1A237E]"
        }}
      >
        <p className="text-[#1A237E]">Are you sure you want to logout?</p>
        <p className="text-[12px] text-[#999]">You will need to login again to access your account.</p>
      </Modal>

      {/* Custom CSS */}
      <style>{`
        .foodmeal-menu .ant-menu-item {
          border-radius: 12px !important;
          margin: 4px 12px !important;
          height: 44px !important;
          line-height: 44px !important;
          padding: 0 16px !important;
          transition: all 0.3s ease !important;
          font-weight: 500 !important;
        }

        .foodmeal-menu .ant-menu-item:hover {
          background: #f6eff0 !important;
          color: ${colors.primary} !important;
        }

        .foodmeal-menu .ant-menu-item-selected {
          background: ${colors.gradient} !important;
          color: #f7f7f7 !important;
          box-shadow: 0 4px 15px rgb(249, 249, 249) !important;
        }

        .foodmeal-menu .ant-menu-item-selected .anticon {
          color: #fff !important;
        }

        .foodmeal-menu .ant-menu-item .anticon {
          font-size: 16px !important;
          margin-right: 12px !important;
        }

        .foodmeal-menu .ant-menu-item .ant-menu-item-icon {
          color: #e92c2c !important;
        }

        .foodmeal-menu .ant-menu-item-selected .ant-menu-item-icon {
          color: #fff !important;
        }

        .foodmeal-menu .ant-menu-submenu-title {
          border-radius: 12px !important;
          margin: 4px 12px !important;
          height: 44px !important;
          line-height: 44px !important;
          padding: 0 16px !important;
          transition: all 0.3s ease !important;
          font-weight: 500 !important;
        }

        .foodmeal-menu .ant-menu-submenu-title:hover {
          background: #FFEBEE !important;
          color: ${colors.primary} !important;
        }

        .foodmeal-menu .ant-menu-submenu-title .anticon {
          font-size: 16px !important;
          margin-right: 12px !important;
        }

        .foodmeal-menu .ant-menu-submenu-title .ant-menu-item-icon {
          color: #666 !important;
        }

        .foodmeal-menu .ant-menu-submenu-open > .ant-menu-submenu-title {
          color: ${colors.primary} !important;
        }

        .foodmeal-menu .ant-menu-submenu-open > .ant-menu-submenu-title .ant-menu-item-icon {
          color: ${colors.primary} !important;
        }

        .foodmeal-menu .ant-menu-submenu-selected > .ant-menu-submenu-title {
          color: ${colors.primary} !important;
        }

        .foodmeal-menu .ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-item-icon {
          color: ${colors.primary} !important;
        }

        .foodmeal-menu .ant-menu-sub .ant-menu-item {
          padding-left: 48px !important;
          margin: 2px 8px !important;
          height: 38px !important;
          line-height: 38px !important;
          font-size: 12px !important;
        }

        .foodmeal-menu .ant-menu-sub .ant-menu-item .anticon {
          font-size: 14px !important;
        }

        .foodmeal-menu .ant-menu-sub .ant-menu-item-selected {
          background: ${colors.gradient} !important;
          color: #fff !important;
        }

        .foodmeal-menu .ant-menu-sub .ant-menu-submenu-title {
          padding-left: 48px !important;
          margin: 2px 8px !important;
          height: 38px !important;
          line-height: 38px !important;
          font-size: 12px !important;
        }

        .foodmeal-menu .ant-menu-sub .ant-menu-sub .ant-menu-item {
          padding-left: 72px !important;
        }

        .foodmeal-menu .ant-menu-submenu-arrow {
          color: #999 !important;
        }

        .foodmeal-menu .ant-menu-submenu-open .ant-menu-submenu-arrow {
          color: ${colors.primary} !important;
        }

          .foodmeal-menu.ant-menu-inline {
            overflow: visible !important;
            border-inline-end: none !important;
          }

          .ant-layout-sider-children {
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
          }

          .sidebar-menu-scroll {
            flex: 1 !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
          }

          .sidebar-menu-scroll::-webkit-scrollbar {
            width: 4px;
          }

          .sidebar-menu-scroll::-webkit-scrollbar-track {
            background: transparent;
          }

          .sidebar-menu-scroll::-webkit-scrollbar-thumb {
            background: rgba(26, 35, 126, 0.2);
            border-radius: 4px;
          }

          .sidebar-menu-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(26, 35, 126, 0.4);
          }
      `}</style>
    </Sider>
  );
}

export default MenuSidebar;