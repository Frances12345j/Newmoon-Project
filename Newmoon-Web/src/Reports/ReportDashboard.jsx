import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Button,
  Space,
  DatePicker,
  Select,
  Tag,
  Progress,
  Alert,
} from "antd";
import {
  BarChartOutlined,
  DollarOutlined,
  InboxOutlined,
  CalendarOutlined,
  ShopOutlined,
  SwapOutlined,
  FileTextOutlined,
  TrendingUpOutlined,
  WarningOutlined,
  DownloadOutlined,
  RightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const ReportDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/dashboard", {
        params: {
          start_date: dateRange[0].format("YYYY-MM-DD"),
          end_date: dateRange[1].format("YYYY-MM-DD"),
        },
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error("[ReportDashboard] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const reportCards = [
    {
      title: "Sales Report",
      description: "Revenue, transactions, and trends",
      icon: <BarChartOutlined style={{ fontSize: 32, color: "#1890ff" }} />,
      color: "#1890ff",
      path: "/reports/sales",
      stats: dashboardData?.sales,
    },
    {
      title: "Inventory Report",
      description: "Stock levels and movements",
      icon: <InboxOutlined style={{ fontSize: 32, color: "#52c41a" }} />,
      color: "#52c41a",
      path: "/reports/inventory",
      stats: dashboardData?.inventory,
    },
    {
      title: "Attendance Report",
      description: "Staff attendance patterns",
      icon: <CalendarOutlined style={{ fontSize: 32, color: "#722ed1" }} />,
      color: "#722ed1",
      path: "/reports/attendance",
      stats: dashboardData?.attendance,
    },
    {
      title: "Branch Report",
      description: "Branch performance comparison",
      icon: <ShopOutlined style={{ fontSize: 32, color: "#13c2c2" }} />,
      color: "#13c2c2",
      path: "/reports/branch",
      stats: dashboardData?.branch,
    },
    {
      title: "Pull-Out Report",
      description: "Item transfers between branches",
      icon: <SwapOutlined style={{ fontSize: 32, color: "#eb2f96" }} />,
      color: "#eb2f96",
      path: "/reports/pullout",
      stats: dashboardData?.pullout,
    },
  ];

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card bordered={false}>
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <FileTextOutlined className="mr-2 text-blue-500" />
                  Report Dashboard
                </Title>
                <Text type="secondary">Central hub for all management reports</Text>
              </Col>
              <Col>
                <Space>
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    format="YYYY-MM-DD"
                    allowClear={false}
                  />
                  <Button type="primary" icon={<DownloadOutlined />} onClick={fetchDashboardData} loading={loading}>
                    Refresh
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Key Metrics */}
        {dashboardData && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic
                  title="Total Revenue"
                  value={dashboardData.total_revenue}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                  formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic
                  title="Total Transactions"
                  value={dashboardData.total_transactions}
                  prefix={<BarChartOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic
                  title="Low Stock Items"
                  value={dashboardData.low_stock_count}
                  prefix={<WarningOutlined />}
                  styles={{ content: { color: dashboardData.low_stock_count > 0 ? "#ff4d4f" : "#52c41a" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card bordered={false}>
                <Statistic
                  title="Attendance Rate"
                  value={dashboardData.attendance_rate}
                  prefix={<CalendarOutlined />}
                  styles={{ content: { color: dashboardData.attendance_rate >= 90 ? "#52c41a" : "#faad14" } }}
                  suffix="%"
                />
              </Card>
            </Col>
          </>
        )}

        {/* Alerts */}
        {dashboardData && dashboardData.alerts && dashboardData.alerts.length > 0 && (
          <Col span={24}>
            <Alert
              message="Attention Required"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {dashboardData.alerts.map((alert, index) => (
                    <li key={index}>{alert}</li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              closable
            />
          </Col>
        )}

        {/* Report Cards */}
        <Col span={24}>
          <Title level={5}>Available Reports</Title>
        </Col>
        {reportCards.map((card) => (
          <Col xs={24} sm={12} md={8} key={card.path}>
            <Card
              hoverable
              bordered={false}
              style={{ height: "100%" }}
              bodyStyle={{ padding: 24 }}
              onClick={() => navigate(card.path)}
            >
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  {card.icon}
                  <RightOutlined style={{ color: card.color }} />
                </div>
                <div>
                  <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                    {card.title}
                  </Title>
                  <Text type="secondary">{card.description}</Text>
                </div>
                {card.stats && (
                  <div style={{ background: "#f5f5f5", padding: 12, borderRadius: 8 }}>
                    <Text strong style={{ fontSize: 12, color: card.color }}>
                      {card.stats.label}
                    </Text>
                    <br />
                    <Text style={{ fontSize: 20, fontWeight: "bold" }}>
                      {card.stats.value}
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          </Col>
        ))}

        {/* Quick Actions */}
        <Col span={24}>
          <Card bordered={false} title="Quick Actions">
            <Space wrap>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => navigate("/reports/sales")}
              >
                Download Sales Report
              </Button>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => navigate("/reports/attendance")}
              >
                View Attendance
              </Button>
              <Button
                icon={<InboxOutlined />}
                onClick={() => navigate("/reports/inventory")}
              >
                Check Inventory
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Recent Activity */}
        {dashboardData && dashboardData.recent_activity && (
          <Col span={24}>
            <Card bordered={false} title="Recent Report Activity">
              <Space direction="vertical" style={{ width: "100%" }}>
                {dashboardData.recent_activity.map((activity, index) => (
                  <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                    <Text>{activity.description}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(activity.timestamp).fromNow()}
                    </Text>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default ReportDashboard;
