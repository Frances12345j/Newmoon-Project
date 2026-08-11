import { useState, useCallback } from "react";
import dayjs from "dayjs";
import {
  Card, Table, Tag, Row, Col, Statistic, Select, Button, Space, Progress, DatePicker, Avatar,
  Modal, Form, InputNumber, Input, message, Tooltip, Empty, Tabs, Divider,
} from "antd";
import {
  ReloadOutlined, TeamOutlined, ShoppingCartOutlined, ShopOutlined,
  GiftOutlined, RiseOutlined, FallOutlined, UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined, AimOutlined, BarChartOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, FundOutlined,
  SettingOutlined, WarningOutlined, StarOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../config/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart as MuiBarChart } from "@mui/x-charts/BarChart";
import { PieChart as MuiPieChart } from "@mui/x-charts/PieChart";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import MuiTextField from "@mui/material/TextField";
import MuiMenuItem from "@mui/material/MenuItem";

const { MonthPicker } = DatePicker;

const RATING_COLORS = {
  Excellent: { color: "green", bg: "#f6ffed", border: "#b7eb8f" },
  Good: { color: "blue", bg: "#e6f7ff", border: "#91d5ff" },
  Average: { color: "orange", bg: "#fff7e6", border: "#ffd591" },
  "Needs Improvement": { color: "volcano", bg: "#fff2e8", border: "#ffbb96" },
  Poor: { color: "red", bg: "#fff1f0", border: "#ffa39e" },
};

const CHART_COLORS = ["#E53935", "#1A237E", "#1565C0", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

const shapes = ["circle", "square", "diamond", "cross", "star", "triangle", "wye"];
const marksMapping = {
  true: true,
  false: false,
  start: "start",
  end: "end",
  every2: ({ index }) => index % 2 === 0,
};
const marksOptions = Object.keys(marksMapping);

function StaffPerformance() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [branchId, setBranchId] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [targetModalVisible, setTargetModalVisible] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [targetForm] = Form.useForm();
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState(null);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkForm] = Form.useForm();
  const [chartMarks, setChartMarks] = useState("true");
  const [chartShape, setChartShape] = useState("circle");

  // Branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches"),
  });
  const branches = branchesData?.data?.data || [];

  // Staff performance
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["staffPerformance", month, branchId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("month", month);
      if (branchId && branchId !== "all") params.append("branch_id", branchId);
      return api.get(`/staff-performance?${params}`).then((r) => r.data);
    },
  });

  // Sales targets
  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ["salesTargets", branchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (branchId && branchId !== "all") params.append("branch_id", branchId);
      return api.get(`/sales-targets?${params}`).then((r) => r.data);
    },
  });

  // Staff list for target assignment
  const { data: staffData } = useQuery({
    queryKey: ["staffList"],
    queryFn: () => api.get("/staff").then((r) => r.data?.data || r.data || []),
  });
  const staffList = Array.isArray(staffData)
    ? staffData.filter((s) => s.role === "staff")
    : [];

  const targets = targetsData?.data || [];
  const staffDataList = data?.data || [];
  const meta = data?.meta || {};
  const branchAggregates = data?.branches || [];
  const monthlyTrend = data?.monthly_trend || [];

  // Mutations
  const saveTargetMutation = useMutation({
    mutationFn: (values) => {
      if (editingTarget) {
        return api.put(`/sales-targets/${editingTarget.id}`, values);
      }
      return api.post("/sales-targets", values);
    },
    onSuccess: (res) => {
      message.success(res.data?.message || "Target saved");
      setTargetModalVisible(false);
      setEditingTarget(null);
      targetForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["salesTargets"] });
      queryClient.invalidateQueries({ queryKey: ["staffPerformance"] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to save target");
    },
  });

  const deleteTargetMutation = useMutation({
    mutationFn: (id) => api.delete(`/sales-targets/${id}`),
    onSuccess: () => {
      message.success("Target deleted");
      setDeleteConfirmVisible(false);
      setDeletingTarget(null);
      queryClient.invalidateQueries({ queryKey: ["salesTargets"] });
      queryClient.invalidateQueries({ queryKey: ["staffPerformance"] });
    },
  });

  const bulkTargetMutation = useMutation({
    mutationFn: (values) => api.post("/sales-targets/bulk", values),
    onSuccess: (res) => {
      message.success(res.data?.message || "Targets set for all branches");
      setBulkModalVisible(false);
      bulkForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["salesTargets"] });
      queryClient.invalidateQueries({ queryKey: ["staffPerformance"] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to set bulk targets");
    },
  });

  const handleMonthChange = (date) => {
    if (date) setMonth(date.format("YYYY-MM"));
  };

  const openTargetModal = (target = null) => {
    setEditingTarget(target);
    if (target) {
      targetForm.setFieldsValue({
        branch_id: target.branch_id,
        target_products: target.target_products,
      });
    } else {
      targetForm.resetFields();
    }
    setTargetModalVisible(true);
  };

  const handleTargetSubmit = () => {
    targetForm.validateFields().then((values) => {
      const payload = {
        branch_id: values.branch_id,
        target_products: values.target_products,
        user_id: null,
      };
      saveTargetMutation.mutate(payload);
    });
  };

  // Chart data — daily products
  const productTargetChart = staffDataList.map((s) => ({
    name: s.full_name?.split(" ")[0] || "Staff",
    sold: s.quota.daily_products_sold ?? s.quota.total_products_sold,
    target: s.quota.daily_target ?? Math.ceil(s.quota.target_products / 30),
    soldMonthly: s.quota.total_products_sold,
    targetMonthly: s.quota.target_products,
  }));

  const attendancePieData = (() => {
    const onTime = staffDataList.reduce((sum, s) => sum + s.attendance.on_time_days, 0);
    const late = staffDataList.reduce((sum, s) => sum + s.attendance.late_days, 0);
    const totalDays = onTime + late;
    if (totalDays === 0) return [];
    return [
      { name: "On Time", value: onTime, color: "#22c55e" },
      { name: "Late", value: late, color: "#f59e0b" },
    ];
  })();

  // Performance table columns
  const columns = [
    {
      title: "Rank",
      key: "rank",
      width: 60,
      align: "center",
      render: (_, __, i) => (
        <div className="flex items-center justify-center">
          {i === 0 ? <TrophyOutlined className="text-yellow-500 text-lg" /> :
           i === 1 ? <StarOutlined className="text-gray-400 text-lg" /> :
           i === 2 ? <StarOutlined className="text-amber-600 text-lg" /> :
           <span className="text-gray-400 font-medium">{i + 1}</span>}
        </div>
      ),
    },
    {
      title: "Staff",
      key: "staff",
      width: 200,
      render: (_, r) => (
        <div className="flex items-center gap-3">
          <Avatar size={36} icon={<UserOutlined />}
            style={{ backgroundColor: r.rating === "Excellent" ? "#22c55e" : r.rating === "Good" ? "#3b82f6" : r.rating === "Average" ? "#f59e0b" : "#ef4444" }} />
          <div>
            <div className="font-semibold text-sm">{r.full_name}</div>
            {r.branch && <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><ShopOutlined />{r.branch.name}</div>}
          </div>
        </div>
      ),
    },
    {
      title: "Attendance",
      key: "attendance",
      width: 200,
      render: (_, r) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-600 font-medium">{r.attendance.present_days}d present</span>
            {r.attendance.late_days > 0 && <span className="text-orange-500">{r.attendance.late_days} late</span>}
          </div>
          <Progress percent={Math.round(r.attendance.attendance_rate)} size="small"
            strokeColor={r.attendance.attendance_rate >= 90 ? "#22c55e" : r.attendance.attendance_rate >= 75 ? "#3b82f6" : "#f59e0b"}
            format={() => `${Math.round(r.attendance.attendance_rate)}%`} />
          <div className="text-xs text-gray-400">{r.attendance.total_hours}h total</div>
        </div>
      ),
    },
    {
      title: "Daily Products vs Target",
      key: "products_target",
      width: 220,
      render: (_, r) => {
        const dailySold = r.quota.daily_products_sold ?? 0;
        const dailyTarget = r.quota.daily_target ?? 0;
        const pct = dailyTarget > 0 ? Math.min(100, Math.round((dailySold / dailyTarget) * 100)) : 0;
        const achieved = pct >= 100;
        return (
          <div>
            <div className="font-semibold text-[#1A237E] text-sm">
              {dailySold} / {dailyTarget} pcs
            </div>
            <Progress percent={pct} size="small" strokeColor={achieved ? "#22c55e" : "#1A237E"} />
            <div className="text-xs mt-0.5">
              {achieved
                ? <span className="text-green-600 font-medium">Target reached ({pct}%)</span>
                : <span className="text-gray-500">{pct}% achieved</span>}
            </div>
          </div>
        );
      },
    },
    {
      title: "Incentive",
      key: "incentive",
      width: 120,
      render: (_, r) => (
        <div className="text-center">
          <div className="text-green-600 font-bold text-sm">₱{r.quota.incentive_amount.toLocaleString()}</div>
          <div className="text-xs text-gray-400">{r.quota.threshold_40_pcs} × 40pcs</div>
        </div>
      ),
    },
    {
      title: "Score",
      key: "score",
      width: 140,
      render: (_, r) => {
        const cfg = RATING_COLORS[r.rating] || RATING_COLORS.Poor;
        return (
          <div className="text-center">
            <div className="text-2xl font-bold mb-1" style={{ color: cfg.color === "green" ? "#22c55e" : cfg.color === "blue" ? "#3b82f6" : cfg.color === "orange" ? "#f59e0b" : "#ef4444" }}>
              {r.performance_score}
            </div>
            <Tag color={cfg.color} className="rounded-full text-xs px-3 py-0.5">{r.rating}</Tag>
          </div>
        );
      },
    },
    {
      title: "Trend",
      key: "trend",
      width: 100,
      render: (_, r) => (
        <div className="space-y-1">
          {[
            { label: "Sales", value: r.trend.sales },
            { label: "Products", value: r.trend.products },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1 text-xs">
              {value > 0 ? <ArrowUpOutlined className="text-green-500" /> :
               value < 0 ? <ArrowDownOutlined className="text-red-500" /> :
               <MinusOutlined className="text-gray-400" />}
              <span className={value > 0 ? "text-green-600" : value < 0 ? "text-red-600" : "text-gray-400"}>
                {Math.abs(value)}%
              </span>
              <span className="text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  // Targets table columns
  const targetColumns = [
    {
      title: "Target For",
      key: "target_for",
      render: (_, r) => (
        <div>
          {r.user ? (
            <div className="flex items-center gap-2">
              <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: "#1A237E" }} />
              <div>
                <div className="font-medium text-sm">{r.user.firstname} {r.user.lastname}</div>
                {r.branch && <div className="text-xs text-gray-400">{r.branch.name}</div>}
              </div>
            </div>
          ) : r.branch ? (
            <div className="flex items-center gap-2">
              <Avatar size={28} icon={<ShopOutlined />} style={{ backgroundColor: "#E53935" }} />
              <div className="font-medium text-sm">{r.branch.name} (All Staff)</div>
            </div>
          ) : (
            <span className="text-gray-400">Unknown</span>
          )}
        </div>
      ),
    },
    {
      title: "Product Target",
      dataIndex: "target_products",
      key: "target_products",
      render: (v) => <span className="font-semibold">{v} pcs</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => openTargetModal(r)} className="text-blue-500" />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" icon={<DeleteOutlined />} onClick={() => { setDeletingTarget(r); setDeleteConfirmVisible(true); }}
              className="text-red-500" />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gradient-to-br from-[#E3F2FD]/30 via-white to-[#FFEBEE]/30 min-h-screen">
      {/* Header */}
      <div className="mb-6 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(229,57,53,0.2)] bg-gradient-to-br from-[#E53935] to-[#1A237E]">
        <div className="px-8 py-6 relative">
          <div className="absolute right-0 top-0 opacity-10">
            <div className="w-64 h-64 rounded-full bg-white -mr-32 -mt-32" />
          </div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                <TrophyOutlined className="mr-2" />Staff Monitoring
              </h1>
              <p className="text-white/80 text-sm">Evaluate employee productivity based on sales targets, attendance, and branch performance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Staff</p>
              <p className="text-white font-bold text-xl">{meta.total_staff || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Sales</p>
              <p className="text-white font-bold text-xl">₱{Number(meta.total_sales || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Today's Achievement</p>
              <p className="text-white font-bold text-xl">{meta.daily_target_achievement_pct || 0}%</p>
              <p className="text-white/50 text-xs">{meta.total_daily_products || 0} / {meta.total_daily_targets || 0} pcs today</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Avg Performance</p>
              <p className="text-white font-bold text-xl">{meta.avg_performance_score || 0}/100</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <div className="text-xs text-gray-500 mb-1">Month</div>
            <MonthPicker value={month ? dayjs(month, "YYYY-MM") : null} onChange={handleMonthChange}
              allowClear={false} format="MMMM YYYY" style={{ width: 160 }} className="rounded-xl" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Branch</div>
            <Select value={branchId} onChange={setBranchId} style={{ width: 180 }} className="rounded-xl"
              options={[{ value: "all", label: "All Branches" }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]} />
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}
            className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]">
            Refresh
          </Button>
          <Button type="primary" icon={<SettingOutlined />}
            onClick={() => openTargetModal()}
            className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none">
            Manage Targets
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        className="mb-6"
        items={[
          {
            key: "overview",
            label: <span><BarChartOutlined /> Performance Overview</span>,
            children: (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { title: "Total Sales", value: `₱${Number(meta.total_sales || 0).toLocaleString()}`, icon: <ShoppingCartOutlined />, color: "#E53935" },
                    { title: "Today's Products Sold", value: `${meta.total_daily_products || 0} pcs`, icon: <GiftOutlined />, color: "#1A237E" },
                    { title: "Avg Attendance", value: `${Math.round(meta.avg_attendance_rate || 0)}%`, icon: <CheckCircleOutlined />, color: "#22c55e" },
                    { title: "Total Incentives", value: `₱${Number(meta.total_incentives || 0).toLocaleString()}`, icon: <TrophyOutlined />, color: "#f59e0b" },
                  ].map(({ title, value, icon, color }) => (
                    <Card key={title} className="rounded-xl border border-[#E3F2FD] shadow-sm" styles={{ body: { padding: 20 } }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
                          <span style={{ color }}>{icon}</span>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">{title}</div>
                          <div className="text-lg font-bold" style={{ color }}>{value}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  {/* Products vs Target Bar Chart */}
                  <Card className="lg:col-span-2 rounded-xl border border-[#E3F2FD] shadow-sm" styles={{ body: { padding: 20 } }}>
                    <h3 className="font-semibold text-[#1A237E] mb-4">
                      <BarChartOutlined className="mr-2" />Daily Products vs Target by Staff
                    </h3>
                    {productTargetChart.length > 0 ? (
                      <MuiBarChart
                        height={300}
                        xAxis={[{ data: productTargetChart.map((d) => d.name) }]}
                        series={[
                          { data: productTargetChart.map((d) => d.sold), label: "Products Sold", color: "#E53935" },
                          { data: productTargetChart.map((d) => d.target), label: "Target (pcs)", color: "#1A237E" },
                        ]}
                      />
                    ) : (
                      <Empty description="No data" />
                    )}
                  </Card>

                  {/* Attendance Pie */}
                  <Card className="rounded-xl border border-[#E3F2FD] shadow-sm" styles={{ body: { padding: 20 } }}>
                    <h3 className="font-semibold text-[#1A237E] mb-4">
                      <ClockCircleOutlined className="mr-2" />Attendance Distribution
                    </h3>
                    {attendancePieData.length > 0 ? (
                      <MuiPieChart
                        height={200}
                        width={200}
                        series={[
                          {
                            data: attendancePieData.map((d, i) => ({
                              id: i,
                              value: d.value,
                              label: d.name,
                              color: d.color,
                            })),
                            highlightScope: { fade: "global", highlight: "item" },
                            faded: { innerRadius: 30, additionalRadius: -30, color: "gray" },
                            valueFormatter: (v) => `${v.label}: ${v.value}`,
                          },
                        ]}
                      />
                    ) : (
                      <Empty description="No attendance data" />
                    )}
                  </Card>
                </div>

                {/* Monthly Trend */}
                {monthlyTrend.length > 0 && (
                  <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm" styles={{ body: { padding: 20 } }}>
                    <h3 className="font-semibold text-[#1A237E] mb-4">
                      <FundOutlined className="mr-2" />6-Month Trend
                    </h3>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <Stack direction={{ xs: "row", md: "column" }} spacing={1}>
                        <MuiTextField
                          select
                          label="Marks"
                          value={chartMarks}
                          onChange={(e) => setChartMarks(e.target.value)}
                          size="small"
                          sx={{ minWidth: 150 }}
                        >
                          {marksOptions.map((opt) => (
                            <MuiMenuItem key={opt} value={opt}>{opt}</MuiMenuItem>
                          ))}
                        </MuiTextField>
                        <MuiTextField
                          select
                          label="Shape"
                          value={chartShape}
                          onChange={(e) => setChartShape(e.target.value)}
                          size="small"
                          sx={{ minWidth: 150 }}
                        >
                          {shapes.map((s) => (
                            <MuiMenuItem key={s} value={s}>{s}</MuiMenuItem>
                          ))}
                        </MuiTextField>
                      </Stack>
                      <Box sx={{ flexGrow: 1 }}>
                        <LineChart
                          height={300}
                          dataset={monthlyTrend.map((d) => ({
                            month: d.label,
                            sales: Number(d.total_sales) || 0,
                            attendance: Number(d.attendance_rate) || 0,
                          }))}
                          series={[
                            {
                              dataKey: "sales",
                              label: "Total Sales",
                              curve: "natural",
                              showMark: marksMapping[chartMarks],
                              shape: chartShape,
                              yAxisId: "left",
                            },
                            {
                              dataKey: "attendance",
                              label: "Attendance Rate (%)",
                              curve: "natural",
                              showMark: marksMapping[chartMarks],
                              shape: chartShape,
                              yAxisId: "right",
                            },
                          ]}
                          xAxis={[{ scaleType: "point", dataKey: "month" }]}
                          yAxis={[
                            { id: "left", valueFormatter: (v) => `₱${(v / 1000).toFixed(0)}k` },
                            { id: "right", position: "right", valueFormatter: (v) => `${v}%` },
                          ]}
                          grid={{ vertical: true, horizontal: true }}
                        />
                      </Box>
                    </Stack>
                  </Card>
                )}

                {/* Performance Table */}
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-[#1A237E]">
                      <TeamOutlined className="mr-2 text-[#E53935]" />Staff Rankings
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Detailed performance metrics for {dayjs(month, "YYYY-MM").format("MMMM YYYY")}</p>
                  </div>
                  <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
                    {staffDataList.length} staff
                  </Tag>
                </div>

                <Card className="rounded-xl border border-[#E3F2FD] shadow-sm">
                  <Table columns={columns} dataSource={staffDataList} rowKey="id" loading={isLoading}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} staff` }}
                    locale={{ emptyText: <div className="py-8 text-center"><TeamOutlined className="text-4xl text-gray-300 mb-2" /><p className="text-gray-500">No performance data for this period</p></div> }} />
                </Card>
              </>
            ),
          },
          {
            key: "branches",
            label: <span><ShopOutlined /> Branch Comparison</span>,
            children: (
              <>
                <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm" styles={{ body: { padding: 20 } }}>
                  <h3 className="font-semibold text-[#1A237E] mb-4">
                    <ShopOutlined className="mr-2" />Branch Performance Overview
                  </h3>
                  {branchAggregates.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={branchAggregates} layout="vertical" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E3F2FD" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="branch_name" tick={{ fontSize: 12 }} width={120} />
                        <ReTooltip />
                        <Legend />
                        <Bar dataKey="total_products" name="Products Sold" fill="#E53935" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="total_target_products" name="Target (pcs)" fill="#1A237E" radius={[0, 4, 4, 0]} opacity={0.4} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No branch data" />
                  )}
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branchAggregates.map((b) => (
                    <Card key={b.branch_id} className="rounded-xl border border-[#E3F2FD] shadow-sm" styles={{ body: { padding: 20 } }}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] flex items-center justify-center text-white font-bold">
                          {b.branch_name?.charAt(0) || "B"}
                        </div>
                        <div>
                          <div className="font-semibold text-[#1A237E]">{b.branch_name}</div>
                          <div className="text-xs text-gray-400">{b.staff_count} staff</div>
                        </div>
                      </div>
                        <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Products vs Sales Target</span>
                            <span className="font-medium">{b.total_products} / {b.total_target_products} pcs</span>
                          </div>
                          <Progress percent={Math.min(100, b.target_achievement_pct || 0)} size="small"
                            strokeColor={(b.target_achievement_pct || 0) >= 100 ? "#22c55e" : "#E53935"} />
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Avg Attendance</span>
                          <span className="font-medium">{b.avg_attendance_rate}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Avg Score</span>
                          <span className="font-bold text-[#1A237E]">{b.avg_score}/100</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Products Sold</span>
                          <span className="font-medium">{b.total_products} pcs</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ),
          },
          {
            key: "targets",
            label: <span><AimOutlined /> Sales Targets</span>,
            children: (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-[#1A237E]">
                      <AimOutlined className="mr-2 text-[#E53935]" />Sales Targets
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Set and manage sales targets per branches </p>
                  </div>
                  <Space>
                    <Button type="primary" icon={<ShopOutlined />}
                      onClick={() => { bulkForm.resetFields(); setBulkModalVisible(true); }}
                      className="rounded-xl bg-gradient-to-br from-[#1A237E] to-[#1565C0] border-none">
                      Set All Branches
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openTargetModal()}
                      className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none">
                      Add Target
                    </Button>
                  </Space>
                </div>
                <Card className="rounded-xl border border-[#E3F2FD] shadow-sm">
                  <Table columns={targetColumns} dataSource={targets} rowKey="id" loading={targetsLoading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: <div className="py-8 text-center"><AimOutlined className="text-4xl text-gray-300 mb-2" /><p className="text-gray-500">No targets set yet. Click "Add Target" to create one.</p></div> }} />
                </Card>
              </>
            ),
          },
        ]}
      />

      {/* Target Modal */}
      <Modal
        title={<span className="text-[#1A237E]">{editingTarget ? <><EditOutlined className="mr-2" />Edit Target</> : <><PlusOutlined className="mr-2" />Add Sales Target</>}</span>}
        open={targetModalVisible}
        onCancel={() => { setTargetModalVisible(false); setEditingTarget(null); targetForm.resetFields(); }}
        onOk={handleTargetSubmit}
        confirmLoading={saveTargetMutation.isPending}
        okText={editingTarget ? "Update" : "Create"}
        okButtonProps={{ className: "bg-[#1A237E] border-[#1A237E] rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
        width={520}
      >
        <Form form={targetForm} layout="vertical" className="mt-4">
          <Form.Item label="Branch" name="branch_id" rules={[{ required: true, message: "Select a branch" }]}>
            <Select placeholder="Select branch" showSearch optionFilterProp="label"
              options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item label="Product Target (pcs)" name="target_products" rules={[{ required: true, message: "Enter product target" }]}>
            <InputNumber style={{ width: "100%" }} min={1} step={10} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        title={<span className="text-red-500"><WarningOutlined className="mr-2" />Delete Target</span>}
        open={deleteConfirmVisible}
        onCancel={() => { setDeleteConfirmVisible(false); setDeletingTarget(null); }}
        onOk={() => deletingTarget && deleteTargetMutation.mutate(deletingTarget.id)}
        confirmLoading={deleteTargetMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true, className: "rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
      >
        <p>Are you sure you want to delete this sales target?</p>
        {deletingTarget && (
          <p className="text-sm text-gray-500 mt-2">
            {deletingTarget.user ? `${deletingTarget.user.firstname} ${deletingTarget.user.lastname}` : deletingTarget.branch?.name || "Unknown"}
          </p>
        )}
      </Modal>

      {/* Set All Branches Bulk Modal */}
      <Modal
        title={<span className="text-[#1A237E]"><ShopOutlined className="mr-2" />Set Target for All Branches</span>}
        open={bulkModalVisible}
        onCancel={() => { setBulkModalVisible(false); bulkForm.resetFields(); }}
        onOk={() => {
          bulkForm.validateFields().then((values) => {
            const payload = { ...values };
            bulkTargetMutation.mutate(payload);
          });
        }}
        confirmLoading={bulkTargetMutation.isPending}
        okText="Apply to All Branches"
        okButtonProps={{ className: "bg-[#1A237E] border-[#1A237E] rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
        width={520}
      >
        <div className="bg-[#E3F2FD] rounded-xl p-4 mb-4 mt-2">
          <p className="text-sm text-[#1A237E] font-medium">
            <ShopOutlined className="mr-1" />This will create or update the sales target for every active branch.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Branch-specific targets will be set. Individual staff targets are not affected.
          </p>
        </div>
        <Form form={bulkForm} layout="vertical">
          <Form.Item label="Product Target (pcs)" name="target_products" rules={[{ required: true, message: "Enter product target" }]}>
            <InputNumber style={{ width: "100%" }} min={1} step={10} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default StaffPerformance;
