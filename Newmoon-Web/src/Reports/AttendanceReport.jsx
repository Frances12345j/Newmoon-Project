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
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const formatTime = (time) => {
  if (!time) return "-";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }
  const date = new Date(time);
  if (isNaN(date.getTime())) return time;
  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const AttendanceReport = () => {
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);

  // Fetch staff list from the correct endpoint
  const fetchStaffList = async () => {
    try {
      // Use the StaffController index which returns paginated { data: [...] }
      const res = await api.get("/staff", { params: { per_page: 100 } });
      const staffData = res.data?.data || [];
      setStaffList(Array.isArray(staffData) ? staffData : []);
    } catch (err) {
      console.warn("Could not load staff list", err);
      setStaffList([]); // fallback to empty array
    }
  };

  const fetchAttendanceReport = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        start_date: dateRange[0].format("YYYY-MM-DD"),
        end_date: dateRange[1].format("YYYY-MM-DD"),
        page: page,
        per_page: pagination.pageSize,
      };
      if (selectedStaff) {
        params.user_id = selectedStaff;
      }
      const res = await api.get("/reports/attendance", { params });
      const data = res.data || {};
      
      setAttendanceData(data.data || []);
      setSummary(data.summary || null);
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      console.error("[AttendanceReport] Error:", err);
      // Optionally show a notification to the user
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffList();
    fetchAttendanceReport(1);
  }, []);

  useEffect(() => {
    fetchAttendanceReport(1);
  }, [dateRange, selectedStaff]);

  const handleTableChange = (pagination) => {
    fetchAttendanceReport(pagination.current);
  };

  const handleExport = () => {
    const csvContent = [
      ["Date", "Staff", "Position", "Time In", "Time Out", "Duration (hrs)", "Status"],
      ...attendanceData.map(row => [
        dayjs(row.date).format("YYYY-MM-DD"),
        row.staff_name,
        row.position,
        row.time_in || "-",
        row.time_out || "-",
        row.duration !== null && row.duration !== undefined ? row.duration : "-",
        row.status,
      ]),
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_report_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      render: (date) => dayjs(date).format("MMM DD, YYYY"),
    },
    {
      title: "Staff",
      dataIndex: "staff_name",
      key: "staff_name",
      sorter: (a, b) => a.staff_name.localeCompare(b.staff_name),
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.position}</Text>
        </div>
      ),
    },
    {
      title: "Time In",
      dataIndex: "time_in",
      key: "time_in",
      render: (time) => formatTime(time),
    },
    {
      title: "Time Out",
      dataIndex: "time_out",
      key: "time_out",
      render: (time) => formatTime(time),
    },
    {
      title: "Duration",
      dataIndex: "duration",
      key: "duration",
      sorter: (a, b) => parseFloat(a.duration || 0) - parseFloat(b.duration || 0),
      render: (duration) => (
        <Text strong>{duration !== null && duration !== undefined ? `${duration} hrs` : "-"}</Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Present", value: "present" },
        { text: "Late", value: "late" },
        { text: "Absent", value: "absent" },
        { text: "Completed", value: "completed" },
        { text: "Completed Late", value: "completed_late" },
        { text: "Incomplete", value: "incomplete" },
      ],
      render: (status) => {
        const config = {
          present: { color: "green", icon: <CheckCircleOutlined /> },
          late: { color: "orange", icon: <ClockCircleOutlined /> },
          absent: { color: "red", icon: <CloseCircleOutlined /> },
          completed: { color: "green", icon: <CheckCircleOutlined /> },
          completed_late: { color: "orange", icon: <ClockCircleOutlined /> },
          incomplete: { color: "default", icon: <ClockCircleOutlined /> },
        };
        const { color, icon } = config[status] || config.absent;
        const label = status === "completed_late" ? "Completed (Late)" : status.charAt(0).toUpperCase() + status.slice(1);
        return <Tag color={color} icon={icon}>{label}</Tag>;
      },
    },
  ];

  const staffSummaryColumns = [
    {
      title: "Staff",
      dataIndex: "staff_name",
      key: "staff_name",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "Days Present",
      dataIndex: "days_present",
      key: "days_present",
      align: "center",
    },
    {
      title: "Days Late",
      dataIndex: "days_late",
      key: "days_late",
      align: "center",
      render: (days) => (days > 0 ? <Text type="warning">{days}</Text> : days),
    },
    {
      title: "Days Absent",
      dataIndex: "days_absent",
      key: "days_absent",
      align: "center",
      render: (days) => (days > 0 ? <Text type="danger">{days}</Text> : days),
    },
    {
      title: "Total Hours",
      dataIndex: "total_hours",
      key: "total_hours",
      render: (hours) => hours !== null && hours !== undefined ? `${hours.toFixed(1)} hrs` : "-",
    },
    {
      title: "Attendance Rate",
      dataIndex: "attendance_rate",
      key: "attendance_rate",
      render: (rate) => (
        <Progress
          percent={rate}
          size="small"
          status={rate >= 90 ? "success" : rate >= 70 ? "normal" : "exception"}
        />
      ),
    },
  ];

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card variant="borderless">
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <CalendarOutlined className="mr-2 text-blue-500" />
                  Attendance Report
                </Title>
                <Text type="secondary">Staff attendance summaries and patterns</Text>
              </Col>
              <Col>
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={handleExport}>
                    Export CSV
                  </Button>
                  <Button type="primary" icon={<FileTextOutlined />} onClick={() => fetchAttendanceReport(1)} loading={loading}>
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
              <Text strong>Staff:</Text>
              <Select
                style={{ width: 200 }}
                placeholder="All Staff"
                allowClear
                value={selectedStaff}
                onChange={setSelectedStaff}
              >
                {Array.isArray(staffList) && staffList.map((staff) => (
                  <Select.Option key={staff.id} value={staff.id}>
                    {staff.firstname} {staff.lastname}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Card>
        </Col>

        {/* Summary Stats */}
        {summary && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Days"
                  value={summary.total_days || 0}
                  prefix={<CalendarOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Present"
                  value={summary.total_present || 0}
                  prefix={<CheckCircleOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Late"
                  value={summary.total_late || 0}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: "#faad14" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Overall Attendance Rate"
                  value={summary.attendance_rate || 0}
                  prefix={<UserOutlined />}
                  styles={{ content: { color: (summary.attendance_rate || 0) >= 90 ? "#52c41a" : "#ff4d4f" } }}
                  suffix="%"
                />
              </Card>
            </Col>
          </>
        )}

        {/* Staff Summary */}
        {summary && summary.staff_summary && summary.staff_summary.length > 0 && (
          <Col span={24}>
            <Card variant="borderless" title="Staff Attendance Summary">
              <Table
                columns={staffSummaryColumns}
                dataSource={summary.staff_summary}
                rowKey="staff_id"
                loading={loading}
                pagination={false}
                scroll={{ x: true }}
              />
            </Card>
          </Col>
        )}

        {/* Detailed Attendance Records */}
        <Col span={24}>
          <Card variant="borderless" title="Attendance Details">
            <Table
              columns={columns}
              dataSource={attendanceData}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: true }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AttendanceReport;