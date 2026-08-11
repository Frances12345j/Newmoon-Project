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
  Tooltip,
  Divider,
  Radio,
} from "antd";
import {
  ShoppingOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  FileTextOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ✅ Replace this with your actual auth hook / context
import { useAuth } from "../hooks/useAuth"; // e.g., returns { user, isAdmin }

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const trendShapes = ["circle", "star", "diamond", "triangle", "cross", "wye"];
const trendShapeMap = {
  circle: "circle",
  star: "star",
  diamond: "diamond",
  triangle: "triangle",
  cross: "cross",
  wye: "wye",
};

const SalesReport = () => {
  // ---------- Authentication ----------
  const { user, isAdmin } = useAuth();
  const userBranchId = user?.branch_id || null; // adjust field name as needed

  // ---------- State ----------
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [groupBy, setGroupBy] = useState("daily");
  const [selectedBranch, setSelectedBranch] = useState(userBranchId); // default to user's branch
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 15,
    total: 0,
  });
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendShape, setTrendShape] = useState("circle");

  // ---------- Fetch report ----------
  const fetchSalesReport = async (page = 1) => {
    setLoading(true);
    try {
      // Build params – always enforce branch for non‑admins
      const params = {
        start_date: dateRange[0].format("YYYY-MM-DD"),
        end_date: dateRange[1].format("YYYY-MM-DD"),
        group_by: groupBy,
        page: page,
        per_page: pagination.pageSize,
      };

      if (!isAdmin) {
        // Non‑admins can only see their own branch
        params.branch_id = userBranchId;
      } else if (selectedBranch) {
        // Admins can pick any branch (or none for all)
        params.branch_id = selectedBranch;
      }
      // If admin and selectedBranch is null, omit branch_id → get all branches

      const [salesRes, branchesRes] = await Promise.all([
        api.get("/reports/sales", { params }),
        api.get("/branches"),
      ]);

      // Set branches list (for the selector)
      setBranches(
        Array.isArray(branchesRes.data)
          ? branchesRes.data
          : branchesRes.data?.data || []
      );

      const data = salesRes.data || {};
      setSalesData(data.data || []);

      // Build summary
      let summaryData = data.summary || {};
      if (groupBy === "branch") {
        summaryData = {
          total_revenue: summaryData.total_revenue || 0,
          total_transactions: summaryData.total_transactions || 0,
          avg_transaction: summaryData.avg_branch_revenue || 0,
          growth: null,
        };
      } else if (groupBy !== "detail" && summaryData.total_sales !== undefined) {
        const totalTransactions = summaryData.total_transactions || 0;
        const totalSales = summaryData.total_sales || 0;
        summaryData = {
          total_revenue: totalSales,
          total_transactions: totalTransactions,
          avg_transaction:
            totalTransactions > 0 ? totalSales / totalTransactions : 0,
          growth: null,
        };
      } else if (groupBy === "detail") {
        const totalSales = data.summary?.total_sales || 0;
        const totalTransactions = data.summary?.total_transactions || 0;
        summaryData = {
          total_revenue: totalSales,
          total_transactions: totalTransactions,
          avg_transaction:
            totalTransactions > 0 ? totalSales / totalTransactions : 0,
          growth: null,
        };
      } else {
        summaryData = {
          total_revenue: 0,
          total_transactions: 0,
          avg_transaction: 0,
          growth: null,
        };
      }
      setSummary(summaryData);

      // Pagination
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      } else {
        setPagination({
          current: 1,
          pageSize: 15,
          total: data.data?.length || 0,
        });
      }
    } catch (err) {
      console.error("[SalesReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Auto‑fetch when filters change ----------
  useEffect(() => {
    fetchSalesReport(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, groupBy, selectedBranch, userBranchId, isAdmin]);

  // ---------- Fetch 6-month trend ----------
  useEffect(() => {
    const fetchTrend = async () => {
      setTrendLoading(true);
      try {
        const end = dayjs().endOf("month");
        const start = dayjs().subtract(5, "month").startOf("month");
        const params = {
          start_date: start.format("YYYY-MM-DD"),
          end_date: end.format("YYYY-MM-DD"),
          group_by: "monthly",
        };
        if (!isAdmin) params.branch_id = userBranchId;
        else if (selectedBranch) params.branch_id = selectedBranch;

        const res = await api.get("/reports/sales", { params });
        const raw = res.data?.data || [];

        const formatted = raw.map((row) => ({
          month: dayjs(row.period + "-01").isValid()
            ? dayjs(row.period + "-01").format("MMM YYYY")
            : row.period,
          sales: Number(row.total_sales) || 0,
          transactions: Number(row.transaction_count) || 0,
          items: Number(row.total_items) || 0,
        }));
        setTrendData(formatted);
      } catch (err) {
        console.error("[SalesReport] Trend fetch error:", err);
      } finally {
        setTrendLoading(false);
      }
    };
    fetchTrend();
  }, [selectedBranch, userBranchId, isAdmin]);

  // ---------- Table pagination handler ----------
  const handleTableChange = (pagination) => {
    fetchSalesReport(pagination.current);
  };

  // ---------- Export CSV ----------
  const handleExport = () => {
    let csvContent = "";
    if (groupBy === "detail") {
      csvContent = [
        ["Date", "Invoice", "Customer", "Items", "Total", "Payment Method", "Branch"],
        ...salesData.map((row) => [
          dayjs(row.created_at).format("YYYY-MM-DD HH:mm"),
          row.invoice_number,
          row.customer_name,
          row.items_count,
          row.total,
          row.payment_method,
          row.branch_name,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");
    } else if (groupBy === "branch") {
      csvContent = [
        ["Branch", "Transactions", "Items Sold", "Total Sales", "Avg/Transaction"],
        ...salesData.map((row) => [
          row.branch_name,
          row.transaction_count,
          row.total_items,
          row.total_sales,
          row.avg_transaction,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");
    } else {
      csvContent = [
        ["Period", "Transactions", "Total Sales", "Items Sold"],
        ...salesData.map((row) => [
          row.period,
          row.transaction_count,
          row.total_sales,
          row.total_items,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_report_${groupBy}_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  // ---------- Table columns ----------
  const groupedColumns = [
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      render: (period) => <Text strong>{period}</Text>,
    },
    {
      title: "Transactions",
      dataIndex: "transaction_count",
      key: "transaction_count",
      align: "center",
    },
    {
      title: "Total Sales",
      dataIndex: "total_sales",
      key: "total_sales",
      render: (total) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(total).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: "Items Sold",
      dataIndex: "total_items",
      key: "total_items",
      align: "center",
    },
    {
      title: "Avg / Transaction",
      key: "avg_transaction",
      render: (_, record) => {
        const avg =
          record.transaction_count > 0
            ? record.total_sales / record.transaction_count
            : 0;
        return `₱${avg.toFixed(2)}`;
      },
    },
  ];

  const detailColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Invoice",
      dataIndex: "invoice_number",
      key: "invoice_number",
      render: (invoice) => <Text strong>{invoice}</Text>,
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
    },
    {
      title: "Items",
      dataIndex: "items",
      key: "items",
      render: (items) => {
        if (!items || items.length === 0) return "-";
        return (
          <Tooltip
            title={items.map((i) => `${i.product?.name || "N/A"} x${i.quantity}`).join("\n")}
          >
            <Tag>
              {items.length === 1
                ? items[0].product?.name || "N/A"
                : `${items[0].product?.name || "N/A"} +${items.length - 1}`}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      sorter: (a, b) => a.total - b.total,
      render: (total) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(total).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: "Payment",
      dataIndex: "payment_method",
      key: "payment_method",
      render: (method) => <Tag color="blue">{method}</Tag>,
    },
    {
      title: "Branch",
      dataIndex: ["branch", "name"],
      key: "branch_name",
      render: (name) => name || "-",
    },
  ];

  const branchColumns = [
    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "Transactions",
      dataIndex: "transaction_count",
      key: "transaction_count",
      align: "center",
      sorter: (a, b) => a.transaction_count - b.transaction_count,
    },
    {
      title: "Items Sold",
      dataIndex: "total_items",
      key: "total_items",
      align: "center",
    },
    {
      title: "Total Sales",
      dataIndex: "total_sales",
      key: "total_sales",
      sorter: (a, b) => a.total_sales - b.total_sales,
      render: (val) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Avg / Transaction",
      dataIndex: "avg_transaction",
      key: "avg_transaction",
      render: (val) => `₱${Number(val).toFixed(2)}`,
    },
  ];

  // ---------- Render ----------
  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card variant="borderless">
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <BarChartOutlined className="mr-2 text-blue-500" />
                  Sales Report
                </Title>
                <Text type="secondary">Detailed sales analysis and trends</Text>
              </Col>
              <Col>
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={handleExport}>
                    Export CSV
                  </Button>
                  <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={fetchSalesReport}
                    loading={loading}
                  >
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
              <Divider orientation="vertical" />
              <Text strong>Group By:</Text>
              <Radio.Group
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <Radio.Button value="daily">Daily</Radio.Button>
                <Radio.Button value="weekly">Weekly</Radio.Button>
                <Radio.Button value="monthly">Monthly</Radio.Button>
                <Radio.Button value="detail">Detail</Radio.Button>
              </Radio.Group>
              <Divider orientation="vertical" />
              <Text strong>Branch:</Text>
              {isAdmin ? (
                <Select
                  style={{ width: 200 }}
                  placeholder="All Branches"
                  allowClear
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                >
                  {branches.map((branch) => (
                    <Select.Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                // Non‑admins see their branch name as a static text
                <Text strong>
                  {branches.find((b) => b.id === userBranchId)?.name ||
                    "Your Branch"}
                </Text>
              )}
            </Space>
          </Card>
        </Col>

        {/* Summary Stats */}
        {summary && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Revenue"
                  value={summary.total_revenue || 0}
                  styles={{ content: { color: "#52c41a" } }}
                  formatter={(value) =>
                    `₱${Number(value).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}`
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title={groupBy === "branch" ? "Total Transactions" : "Total Transactions"}
                  value={summary.total_transactions || 0}
                  prefix={<ShoppingOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title={groupBy === "branch" ? "Avg Branch Revenue" : "Avg Transaction"}
                  value={summary.avg_transaction || 0}
                  styles={{ content: { color: "#722ed1" } }}
                  formatter={(value) => `₱${Number(value).toFixed(2)}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title={groupBy === "branch" ? "Active Branches" : "Growth (vs previous)"}
                  value={
                    groupBy === "branch"
                      ? summary.total_branches || 0
                      : summary.growth !== null
                      ? summary.growth
                      : "N/A"
                  }
                  prefix={
                    groupBy === "branch" ? (
                      <BarChartOutlined />
                    ) : summary.growth !== null && summary.growth >= 0 ? (
                      <RiseOutlined />
                    ) : (
                      <FallOutlined />
                    )
                  }
                  styles={{
                    content: {
                      color:
                        groupBy === "branch"
                          ? "#1890ff"
                          : summary.growth !== null && summary.growth >= 0
                          ? "#52c41a"
                          : "#ff4d4f",
                    },
                  }}
                  suffix={
                    groupBy === "branch" ? "" : summary.growth !== null ? "%" : ""
                  }
                />
              </Card>
            </Col>
          </>
        )}

        {/* 6-Month Trend Chart */}
        <Col span={24}>
          <Card
            variant="borderless"
            title="6-Month Sales Trend"
            extra={
              <Select
                value={trendShape}
                onChange={setTrendShape}
                style={{ width: 120 }}
                size="small"
              >
                {trendShapes.map((s) => (
                  <Select.Option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Select.Option>
                ))}
              </Select>
            }
          >
            {trendLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>Loading...</div>
            ) : trendData.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                No trend data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={trendData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                    }
                  />
                  <ReTooltip
                    formatter={(value, name) => {
                      if (name === "Sales")
                        return [
                          `₱${Number(value).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}`,
                          name,
                        ];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    name="Sales"
                    stroke="#52c41a"
                    strokeWidth={2}
                    dot={{
                      r: 5,
                      fill: "#52c41a",
                      stroke: "#fff",
                      strokeWidth: 2,
                      symbol: trendShapeMap[trendShape],
                    }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="transactions"
                    name="Transactions"
                    stroke="#1890ff"
                    strokeWidth={2}
                    dot={{
                      r: 5,
                      fill: "#1890ff",
                      stroke: "#fff",
                      strokeWidth: 2,
                      symbol: trendShapeMap[trendShape],
                    }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* Data Table */}
        <Col span={24}>
          <Card
            variant="borderless"
            title={
              groupBy === "detail"
                ? "Transaction Details"
                : groupBy === "branch"
                ? "Sales by Branch"
                : `Sales by ${groupBy}`
            }
          >
            {groupBy === "detail" ? (
              <Table
                columns={detailColumns}
                dataSource={salesData}
                rowKey="id"
                loading={loading}
                pagination={pagination}
                onChange={handleTableChange}
                scroll={{ x: true }}
              />
            ) : groupBy === "branch" ? (
              <Table
                columns={branchColumns}
                dataSource={salesData}
                rowKey="branch_id"
                loading={loading}
                pagination={false}
                scroll={{ x: true }}
              />
            ) : (
              <Table
                columns={groupedColumns}
                dataSource={salesData}
                rowKey="period"
                loading={loading}
                pagination={false}
                scroll={{ x: true }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SalesReport;