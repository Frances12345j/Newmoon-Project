import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Table,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  Statistic,
  Tag,
  Progress,
  Tooltip,
  Radio,
} from "antd";
import {
  ShopOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  FileTextOutlined,
  TrophyOutlined,
  TeamOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const BranchReport = () => {
  const [loading, setLoading] = useState(false);
  const [branchData, setBranchData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [branches, setBranches] = useState([]);
  const [viewMode, setViewMode] = useState("performance");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });

  const fetchBranchReport = async (page = 1) => {
    setLoading(true);
    try {
      const [branchRes, branchesRes] = await Promise.all([
        api.get("/reports/branches", {
          params: {
            start_date: dateRange[0].format("YYYY-MM-DD"),
            end_date: dateRange[1].format("YYYY-MM-DD"),
            branch_id: selectedBranch,
            view_mode: viewMode,
            page: page,
            per_page: pagination.pageSize,
          },
        }),
        api.get("/branches"),
      ]);

      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      const data = branchRes.data || {};
      
      setBranchData(data.data || []);
      setSummary(data.summary || null);
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      console.error("[BranchReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranchReport(1);
  }, [dateRange, selectedBranch, viewMode]);

  const handleTableChange = (pagination) => {
    fetchBranchReport(pagination.current);
  };

  const handleExport = () => {
    const csvContent = [
      ["Branch", "Location", "Total Sales", "Transactions", "Avg Transaction", "Staff Count", "Sales/Staff", "Growth %"],
      ...branchData.map(row => [
        row.name,
        row.location,
        row.total_sales,
        row.transaction_count,
        row.avg_transaction,
        row.staff_count,
        row.sales_per_staff,
        row.growth,
      ]),
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch_report_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  const performanceColumns = [
    {
      title: "Branch",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.location}</Text>
        </div>
      ),
    },
    {
      title: "Total Sales",
      dataIndex: "total_sales",
      key: "total_sales",
      sorter: (a, b) => a.total_sales - b.total_sales,
      render: (amount) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Transactions",
      dataIndex: "transaction_count",
      key: "transaction_count",
      sorter: (a, b) => a.transaction_count - b.transaction_count,
      align: "center",
    },
    {
      title: "Avg/Transaction",
      dataIndex: "avg_transaction",
      key: "avg_transaction",
      sorter: (a, b) => a.avg_transaction - b.avg_transaction,
      render: (avg) => avg !== null && avg !== undefined ? `₱${Number(avg).toFixed(2)}` : "-",
    },
    {
      title: "Staff Count",
      dataIndex: "staff_count",
      key: "staff_count",
      align: "center",
      render: (count) => (
        <Space>
          <TeamOutlined />
          <Text>{count}</Text>
        </Space>
      ),
    },
    {
      title: "Sales/Staff",
      dataIndex: "sales_per_staff",
      key: "sales_per_staff",
      sorter: (a, b) => a.sales_per_staff - b.sales_per_staff,
      render: (value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
    },
    {
      title: "Growth",
      dataIndex: "growth",
      key: "growth",
      render: (growth) => {
        if (growth === null || growth === undefined) return "-";
        const isPositive = growth >= 0;
        return (
          <Tag color={isPositive ? "green" : "red"} icon={isPositive ? <RiseOutlined /> : <FallOutlined />}>
            {isPositive ? "+" : ""}{growth.toFixed(1)}%
          </Tag>
        );
      },
    },
  ];

  const comparisonColumns = [
    {
      title: "Metric",
      dataIndex: "metric",
      key: "metric",
      render: (metric) => <Text strong>{metric}</Text>,
    },
  ];

  // Add dynamic columns for each branch
  if (branchData.length > 0) {
    branchData.forEach((branch, index) => {
      comparisonColumns.push({
        title: branch.name,
        dataIndex: `branch_${index}`,
        key: `branch_${index}`,
        render: (value) => <Text>{value}</Text>,
      });
    });
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card variant="borderless">
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <ShopOutlined className="mr-2 text-blue-500" />
                  Branch Report
                </Title>
                <Text type="secondary">Branch performance analysis and comparisons</Text>
              </Col>
              <Col>
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={handleExport}>
                    Export CSV
                  </Button>
                  <Button type="primary" icon={<FileTextOutlined />} onClick={fetchBranchReport} loading={loading}>
                    Generate Report
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Filters */}
        <Col span={24}>
          <Card variant="borderless" size="small">
            <Space wrap>
              <Text strong>Date Range:</Text>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="YYYY-MM-DD"
                allowClear={false}
              />
              <Text strong>Branch:</Text>
              <Select
                style={{ width: 200 }}
                placeholder="All Branches"
                allowClear
                value={selectedBranch}
                onChange={setSelectedBranch}
              >
                {Array.isArray(branches) && branches.map((branch) => (
                  <Select.Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Select.Option>
                ))}
              </Select>
              <Text strong>View:</Text>
              <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                <Radio.Button value="performance">Performance</Radio.Button>
                <Radio.Button value="comparison">Comparison</Radio.Button>
              </Radio.Group>
            </Space>
          </Card>
        </Col>

        {/* Summary Stats */}
        {summary && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Revenue (All Branches)"
                  value={summary.total_revenue}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                  formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Transactions"
                  value={summary.total_transactions}
                  prefix={<ShoppingOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Avg/Branch Revenue"
                  value={summary.avg_branch_revenue}
                  prefix={<ShopOutlined />}
                  styles={{ content: { color: "#722ed1" } }}
                  formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Top Performing Branch"
                  value={summary.top_branch || "-"}
                  prefix={<TrophyOutlined />}
                  styles={{ content: { color: "#faad14" } }}
                />
              </Card>
            </Col>
          </>
        )}

        {/* Performance Table */}
        {viewMode === "performance" && (
          <Col span={24}>
            <Card variant="borderless" title="Branch Performance Rankings">
              <Table
                columns={performanceColumns}
                dataSource={branchData}
                rowKey="id"
                loading={loading}
                pagination={pagination}
                onChange={handleTableChange}
                scroll={{ x: true }}
              />
            </Card>
          </Col>
        )}

        {/* Comparison Table */}
        {viewMode === "comparison" && summary && summary.comparison && (
          <Col span={24}>
            <Card variant="borderless" title="Branch Comparison">
              <Table
                columns={comparisonColumns}
                dataSource={summary.comparison}
                rowKey="metric"
                loading={loading}
                pagination={false}
                scroll={{ x: true }}
              />
            </Card>
          </Col>
        )}

        {/* Performance Distribution */}
        {summary && summary.performance_distribution && (
          <Col span={24}>
            <Card variant="borderless" title="Revenue Distribution">
              <Row gutter={[16, 16]}>
                {summary.performance_distribution.map((item) => (
                  <Col xs={24} sm={12} md={8} key={item.branch_id}>
                    <Card size="small">
                      <Text strong>{item.branch_name}</Text>
                      <Progress
                        percent={item.percentage}
                        status={item.percentage >= 30 ? "success" : item.percentage >= 15 ? "normal" : "exception"}
                        strokeColor={{
                          "0%": "#ff4d4f",
                          "50%": "#faad14",
                          "100%": "#52c41a",
                        }}
                      />
                      <Text type="secondary">
                        ₱{Number(item.revenue).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({item.percentage}%)
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default BranchReport;
