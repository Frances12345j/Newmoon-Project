import { useState } from "react";
import {
  Card, Table, Tag, Row, Col, Statistic, Select, Button, Space, Modal, Form, Input, message, Tooltip, DatePicker,
} from "antd";
import {
  ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  CheckOutlined, CloseOutlined, UserOutlined, ShoppingCartOutlined, ArrowLeftOutlined, SearchOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../config/api";

const { TextArea } = Input;
const { RangePicker } = DatePicker;

function BackToSale() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["backToSalesAll", currentPage, pageSize, statusFilter, searchText, dateRange],
    queryFn: () => {
      const params = { page: currentPage, per_page: pageSize };
      if (statusFilter !== "all") params.status = statusFilter;
      if (searchText.trim()) params.search = searchText.trim();
      if (dateRange?.[0] && dateRange?.[1]) {
        params.start_date = dateRange[0].format("YYYY-MM-DD");
        params.end_date = dateRange[1].format("YYYY-MM-DD");
      }
      return api.get("/back-to-sales/all", { params });
    },
  });

  const records = data?.data?.data || [];
  const stats = data?.data?.stats || {};
  const paginationMeta = data?.data?.pagination || {};

  const approveMutation = useMutation({
    mutationFn: ({ id }) => api.post(`/back-to-sales/${id}/approve`),
    onSuccess: () => {
      message.success("Return approved — stock restored");
      setShowApproveModal(false);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["backToSalesAll"] });
    },
    onError: (e) => message.error(e.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) =>
      api.post(`/back-to-sales/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Return rejected");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["backToSalesAll"] });
    },
    onError: (e) => message.error(e.response?.data?.message || "Failed to reject"),
  });

  const handleApprove = () => {
    approveMutation.mutate({ id: selected.id });
  };

  const handleReject = (values) => {
    rejectMutation.mutate({ id: selected.id, adminNotes: values.admin_notes || null });
  };

  const statusTag = (status) => {
    const m = {
      pending: { color: "orange", icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { color: "green", icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { color: "red", icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const c = m[status] || m.pending;
    return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  const columns = [
    {
      title: "Staff",
      key: "staff",
      width: 180,
      render: (_, r) => (
        <div>
          <div className="font-semibold"><UserOutlined className="mr-1" />{r.user?.firstname} {r.user?.lastname}</div>
          <div className="text-gray-500 text-xs">ID: {r.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      width: 180,
      render: (_, r) => (
        <div>
          <div className="font-semibold">{r.product?.name}</div>
          <div className="text-gray-500 text-xs">Branch: {r.branch?.name}</div>
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 80,
      render: (v) => <span className="font-semibold text-lg">{v}</span>,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      width: 200,
      render: (v) => v || <span className="text-gray-400">-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v) => statusTag(v),
    },
    {
      title: "Returned At",
      dataIndex: "returned_at",
      key: "returned_at",
      width: 160,
      render: (v) => fmtDate(v),
    },
    {
      title: "Processed",
      key: "processed",
      width: 160,
      render: (_, r) => {
        if (r.status === "approved" && r.approved_at) return <span className="text-green-600">{fmtDate(r.approved_at)}</span>;
        if (r.status === "rejected" && r.rejected_at) return <span className="text-red-600">{fmtDate(r.rejected_at)}</span>;
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      width: 160,
      render: (v) => v || <span className="text-gray-400">-</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, r) => (
        <Space>
          {r.status === "pending" && (
            <>
              <Tooltip title="Approve — return stock to inventory">
                <Button type="primary" size="small" icon={<CheckOutlined />}
                  onClick={() => { setSelected(r); setShowApproveModal(true); }}>
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button danger size="small" icon={<CloseOutlined />}
                  onClick={() => { setSelected(r); setShowRejectModal(true); }}>
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {r.status !== "pending" && <span className="text-gray-400 text-sm">-</span>}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Back-to-Sales</h1>
        <p className="text-gray-500">Manage unsold products returned to inventory for resale (FIFO)</p>
      </div>

      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Returns" value={stats.total || 0} prefix={<ShoppingCartOutlined />} styles={{ content: { color: "#1890ff" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Pending" value={stats.pending || 0} styles={{ content: { color: "#faad14" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Approved" value={stats.approved || 0} styles={{ content: { color: "#3f8600" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Qty Returned" value={stats.total_quantity || 0} suffix="pcs" styles={{ content: { color: "#722ed1" } }} />
          </Card>
        </Col>
      </Row>

      <Card className="mb-6">
        <Space wrap>
          <span className="text-gray-600">Status:</span>
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }} style={{ width: 130 }}>
            <Select.Option value="all">All</Select.Option>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <Input
            placeholder="Search product or staff..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
            style={{ width: 220 }}
            allowClear
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            style={{ width: 250 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>Refresh</Button>
        </Space>
      </Card>

      <Card title="Return Requests" extra={<span className="text-gray-500">{paginationMeta.total || records.length} record(s)</span>}>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: paginationMeta.current_page || 1,
            pageSize: pageSize,
            total: paginationMeta.total || 0,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} records`,
          }}
          locale={{ emptyText: <div className="py-8 text-center"><ArrowLeftOutlined className="text-4xl text-gray-300 mb-2" /><p className="text-gray-500">No back-to-sales records found</p></div> }}
        />
      </Card>

      <Modal
        title="Approve Return to Stock"
        open={showApproveModal}
        onCancel={() => { setShowApproveModal(false); setSelected(null); }}
        onOk={handleApprove}
        confirmLoading={approveMutation.isPending}
        okText="Approve & Restore Stock"
        okButtonProps={{ icon: <CheckOutlined /> }}
      >
        {selected && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-green-50">
              <div className="font-semibold">{selected.user?.firstname} {selected.user?.lastname}</div>
              <div className="text-lg font-bold text-green-600 mt-1">{selected.product?.name}</div>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-600">Quantity: <strong>{selected.quantity}</strong></span>
                <span className="text-gray-600">Branch: <strong>{selected.branch?.name}</strong></span>
              </div>
              {selected.notes && <div className="text-gray-600 text-sm mt-2">Notes: {selected.notes}</div>}
            </div>
            <div className="text-sm text-gray-500">
              Approving will add <strong>{selected.quantity}</strong> unit(s) of <strong>{selected.product?.name}</strong> back to <strong>{selected.branch?.name}</strong> inventory.
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Reject Return" open={showRejectModal} onCancel={() => { setShowRejectModal(false); rejectForm.resetFields(); setSelected(null); }} footer={null} destroyOnHidden>
        {selected && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg">
            <div className="font-semibold">{selected.user?.firstname} {selected.user?.lastname}</div>
            <div className="text-lg font-bold text-red-600 mt-1">{selected.product?.name}</div>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-gray-600">Quantity: <strong>{selected.quantity}</strong></span>
              <span className="text-gray-600">Branch: <strong>{selected.branch?.name}</strong></span>
            </div>
            {selected.notes && <div className="text-gray-600 text-sm mt-2">Notes: {selected.notes}</div>}
          </div>
        )}
        <Form form={rejectForm} layout="vertical" onFinish={handleReject} initialValues={{ admin_notes: "" }}>
          <Form.Item label="Rejection Reason (Optional)" name="admin_notes" rules={[{ max: 500, message: "Reason cannot exceed 500 characters" }]}>
            <TextArea rows={4} placeholder="Provide a reason for rejection" maxLength={500} showCount disabled={rejectMutation.isPending} />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => { setShowRejectModal(false); rejectForm.resetFields(); setSelected(null); }} disabled={rejectMutation.isPending}>Cancel</Button>
              <Button danger htmlType="submit" loading={rejectMutation.isPending} icon={<CloseOutlined />}>Reject</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BackToSale;
