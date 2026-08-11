import React, { useEffect, useState } from "react";
import { Card, Table, Tag, Button, Space, DatePicker, Input, message } from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

function AttendanceView() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadAttendanceData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/attendance", {
        params: { date: selectedDate },
      });
      const records = response.data?.data ?? [];
      setAttendanceData(records);
    } catch (error) {
      console.error("Error loading attendance:", error);
      message.error("Failed to load attendance data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [selectedDate]);

  const filteredData = Array.isArray(attendanceData)
    ? attendanceData.filter((item) => {
        const firstName = item.user?.firstname || "";
        const lastName = item.user?.lastname || "";
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];

  const formatTime = (time) => {
    if (!time) return "-";
    try {
      if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
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
    } catch {
      return time;
    }
  };

  const statusTag = (status) => {
    const normalized = String(status).toLowerCase().trim();
    if (normalized === "present" || normalized === "completed") {
      return <Tag color="green" icon={<CheckCircleOutlined />}>Present</Tag>;
    }
    if (normalized === "completed_late") {
      return <Tag color="green" icon={<CheckCircleOutlined />}>Completed (Late)</Tag>;
    }
    if (normalized === "late") {
      return <Tag color="orange" icon={<ClockCircleOutlined />}>Late</Tag>;
    }
    if (normalized === "absent") {
      return <Tag color="red" icon={<CloseCircleOutlined />}>Absent</Tag>;
    }
    return <Tag color="default">{status || "Unknown"}</Tag>;
  };

  const getStatusStats = (data) => {
    let present = 0, late = 0, absent = 0;
    data.forEach(item => {
      const status = String(item.status).toLowerCase().trim();
      if (status === "present" || status === "completed" || status === "completed_late") present++;
      else if (status === "late") late++;
      else if (status === "absent") absent++;
    });
    return { present, late, absent };
  };

  const totalStaff = filteredData.length;
  const stats = getStatusStats(filteredData);

  const columns = [
    {
      title: "Staff Name",
      key: "name",
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-semibold">
            {r.user?.firstname?.charAt(0) || "?"}
          </div>
          <span className="font-medium">
            {r.user?.firstname && r.user?.lastname
              ? `${r.user.firstname} ${r.user.lastname}`
              : r.user?.firstname || r.user?.lastname || "Unknown Staff"}
          </span>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, r) => r.branch?.name || <span className="text-gray-400">N/A</span>,
    },
    {
      title: "Time In",
      key: "time_in",
      align: "center",
      render: (_, r) => <span className="font-mono">{formatTime(r.time_in)}</span>,
    },
    {
      title: "Time Out",
      key: "time_out",
      align: "center",
      render: (_, r) => <span className="font-mono">{formatTime(r.time_out)}</span>,
    },
    {
      title: "Status",
      key: "status",
      align: "center",
      render: (_, r) => statusTag(r.status),
    },
    {
      title: "Hours Worked",
      key: "hours_worked",
      align: "center",
      render: (_, r) => (r.hours_worked ? `${r.hours_worked}h` : "-"),
    },
    {
      title: "Daily Rate",
      key: "daily_rate",
      align: "right",
      render: (_, r) => <span className="text-green-600 font-medium">₱{r.daily_rate?.toFixed(2) || "0.00"}</span>,
    },
  ];

  return (
    <div className="p-6 bg-gradient-to-br from-[#E3F2FD]/30 via-white to-[#FFEBEE]/30 min-h-screen">
      {/* Header - FoodMeal Style */}
      <div className="mb-6 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(229,57,53,0.2)] bg-gradient-to-br from-[#E53935] to-[#1A237E]">
        <div className="px-8 py-6 relative">
          {/* Decorative circles */}
          <div className="absolute right-0 top-0 opacity-10">
            <div className="w-64 h-64 rounded-full bg-white -mr-32 -mt-32"></div>
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="w-48 h-48 rounded-full bg-white"></div>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                <UserOutlined className="mr-2" />
                Attendance Sheet
              </h1>
              <p className="text-white/80 text-sm">Daily staff attendance tracking</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Staff</p>
              <p className="text-white font-bold text-xl">{totalStaff}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Present</p>
              <p className="text-white font-bold text-xl">{stats.present}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Late</p>
              <p className="text-white font-bold text-xl">{stats.late}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Absent</p>
              <p className="text-white font-bold text-xl">{stats.absent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - FoodMeal Style */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <Space wrap>
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={(date) => {
              if (date) setSelectedDate(date.format("YYYY-MM-DD"));
            }}
            allowClear={false}
            className="rounded-xl"
          />
          <Input
            placeholder="Search staff..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 220 }}
            allowClear
            className="rounded-xl"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAttendanceData}
            loading={isLoading}
            className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Records Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <UserOutlined className="mr-2 text-[#E53935]" />
              Attendance Records
            </h2>
            <p className="text-sm text-gray-500 mt-1">Staff attendance for {dayjs(selectedDate).format("MMMM D, YYYY")}</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#E3F2FD] shadow-sm">
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey={(record) => record.id ?? `${record.user_id}-${selectedDate}`}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} records` }}
          locale={{ emptyText: <div className="py-8 text-center"><UserOutlined className="text-4xl text-gray-300 mb-2" /><p className="text-gray-500">No attendance records found for this date</p><p className="text-gray-400 text-sm">Try selecting a different date</p></div> }}
        />
      </Card>
    </div>
  );
}

export default AttendanceView;
