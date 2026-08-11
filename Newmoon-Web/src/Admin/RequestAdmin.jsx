import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, message, Tag, Row, Col, Statistic, Space, Select, Tooltip, Tabs } from "antd";
import { 
  DollarOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  InboxOutlined
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "../config/api";

const { TextArea } = Input;


function RequestAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch all cash advances
  const { data: advancesData, isLoading: advancesLoading, refetch: refetchAdvances } = useQuery({
    queryKey: ['cashAdvancesAll'],
    queryFn: () => api.get("/cash-advances/all"),
  });

  // Fetch all stock requests
  const { data: stockRequestsData, isLoading: stockRequestsLoading, refetch: refetchStockRequests } = useQuery({
    queryKey: ['stockRequestsAll'],
    queryFn: () => api.get("/supply-requests/all"),
  });

  const advances = advancesData?.data?.data || [];
  const stockRequests = stockRequestsData?.data?.data || [];
  const isLoading = advancesLoading || stockRequestsLoading;

  // Combine both request types into a single array
  const allRequests = [
    ...advances.map(a => ({ ...a, request_type: 'cash_advance' })),
    ...stockRequests.map(s => ({ ...s, request_type: 'stock' }))
  ].sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

  // Filter requests based on status
  const filteredRequests = statusFilter === "all" 
    ? allRequests
    : allRequests.filter((a) => a.status === statusFilter);

  // Approve mutation for cash advances
  const approveAdvanceMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/cash-advances/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Cash advance request approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['cashAdvancesAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve request");
    },
  });

  // Reject mutation for cash advances
  const rejectAdvanceMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/cash-advances/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Cash advance request rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['cashAdvancesAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject request");
    },
  });

  // Approve mutation for stock requests
  const approveStockMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/supply-requests/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock request approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['stockRequestsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve request");
    },
  });

  // Reject mutation for stock requests
  const rejectStockMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/supply-requests/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock request rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['stockRequestsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject request");
    },
  });

  const handleApprove = (values) => {
    if (selectedRequest.request_type === "cash_advance") {
      approveAdvanceMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    } else {
      approveStockMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    }
  };

  const handleReject = (values) => {
    if (selectedRequest.request_type === "cash_advance") {
      rejectAdvanceMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    } else {
      rejectStockMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      pending: { color: "orange", icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { color: "green", icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { color: "red", icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getRequestTypeTag = (type) => {
    const config = {
      cash_advance: { color: "blue", icon:<span style={{ fontSize: "14px",gap: '4', display: "inline-block" }}>₱</span>, text: "Cash Advance" },
      stock: { color: "purple", icon: <InboxOutlined />, text: "Supply Request" },
    };
    const typeConfig = config[type] || config.cash_advance;
    return (
      <Tag color={typeConfig.color} icon={typeConfig.icon}>
        {typeConfig.text}
      </Tag>
    );
  };

  // Unified columns for both request types
  const columns = [
    {
      title: "Staff",
      key: "staff",
      render: (_, record) => (
        <div>
          <div className="font-semibold">
            {record.user?.firstname} {record.user?.lastname}
          </div>
          <div className="text-gray-500 text-xs">ID: {record.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Type",
      key: "request_type",
      render: (_, record) => getRequestTypeTag(record.request_type),
    },
    {
      title: "Details",
      key: "details",
      render: (_, record) => {
        if (record.request_type === "cash_advance") {
          return <span className="font-semibold">{formatCurrency(record.amount)}</span>;
        } else {
          return (
            <div>
              <div className="font-semibold">{record.product?.name}</div>
              <div className="text-gray-500 text-xs">Qty: {record.quantity}</div>
              <div className="text-gray-500 text-xs">{record.branch?.name}</div>
            </div>
          );
        }
      },
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason) => reason || <span className="text-gray-400">-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "Requested At",
      dataIndex: "requested_at",
      key: "requested_at",
      render: (date) => formatDate(date),
    },
    {
      title: "Processed At",
      key: "processed_date",
      render: (_, record) => {
        if (record.status === "approved" && record.approved_at) {
          return <span className="text-green-600">{formatDate(record.approved_at)}</span>;
        }
        if (record.status === "rejected" && record.rejected_at) {
          return <span className="text-red-600">{formatDate(record.rejected_at)}</span>;
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      render: (notes) => notes || <span className="text-gray-400">-</span>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {record.status === "pending" && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setSelectedRequest(record);
                    setShowApproveModal(true);
                  }}
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setSelectedRequest(record);
                    setShowRejectModal(true);
                  }}
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {record.status !== "pending" && (
            <span className="text-gray-400 text-sm">No actions</span>
          )}
        </Space>
      ),
    },
  ];

  // Combined statistics
  const statistics = {
    total: allRequests.length,
    pending: allRequests.filter((a) => a.status === "pending").length,
    approved: allRequests.filter((a) => a.status === "approved").length,
    rejected: allRequests.filter((a) => a.status === "rejected").length,
    cashAdvanceTotal: advances
      .filter((a) => a.status === "approved")
      .reduce((sum, a) => sum + Number(a.amount), 0),
    stockTotal: stockRequests
      .filter((a) => a.status === "approved")
      .reduce((sum, a) => sum + Number(a.quantity), 0),
  };

  const handleRefresh = () => {
    refetchAdvances();
    refetchStockRequests();
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Request Management</h1>
        <p className="text-gray-600">Approve or reject staff requests</p>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Requests"
              value={statistics.total}
              styles={{ content: { color: "#1890ff" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending"
              value={statistics.pending}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Approved"
              value={statistics.approved}
              styles={{ content: { color: "#3f8600" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Cash Advance Total"
              value={statistics.cashAdvanceTotal}
              precision={2}
              prefix="₱"
              styles={{ content: { color: "#3f8600" } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Bar */}
      <Card className="mb-6">
        <Space>
          <span className="text-gray-600">Filter by status:</span>
            <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
          >
            <Select.Option value="all">All</Select.Option>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Requests Table */}
      <Card
        title="All Requests"
        extra={<span className="text-gray-500">{filteredRequests.length} request(s)</span>}
      >
        <Table
          columns={columns}
          dataSource={filteredRequests}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} requests`,
          }}
          locale={{
            emptyText: (
              <div className="py-8 text-center">
                <DollarOutlined className="text-4xl text-gray-300 mb-2" />
                <p className="text-gray-500">No requests found</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Approve Modal */}
      <Modal
        title={selectedRequest?.request_type === "cash_advance" ? "Approve Cash Advance" : "Approve Stock Request"}
        open={showApproveModal}
        onCancel={() => {
          setShowApproveModal(false);
          approveForm.resetFields();
          setSelectedRequest(null);
        }}
        footer={null}
        destroyOnHidden
      >
        {selectedRequest && (
          <div className={`mb-4 p-4 rounded-lg ${selectedRequest.request_type === "cash_advance" ? "bg-blue-50" : "bg-green-50"}`}>
            <div className="font-semibold">
              {selectedRequest.user?.firstname} {selectedRequest.user?.lastname}
            </div>
            {selectedRequest.request_type === "cash_advance" ? (
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(selectedRequest.amount)}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-green-600">
                  {selectedRequest.product?.name}
                </div>
                <div className="text-gray-600 text-sm">
                  Quantity: {selectedRequest.quantity}
                </div>
                <div className="text-gray-600 text-sm">
                  Branch: {selectedRequest.branch?.name}
                </div>
              </>
            )}
            {selectedRequest.reason && (
              <div className="text-gray-600 text-sm mt-1">
                Reason: {selectedRequest.reason}
              </div>
            )}
          </div>
        )}
        <Form
          form={approveForm}
          layout="vertical"
          onFinish={handleApprove}
          initialValues={{ admin_notes: "" }}
        >
          <Form.Item
            label="Admin Notes (Optional)"
            name="admin_notes"
            rules={[
              { max: 500, message: "Notes cannot exceed 500 characters" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Add any notes for this approval"
              maxLength={500}
              showCount
              disabled={approveAdvanceMutation.isPending || approveStockMutation.isPending}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowApproveModal(false);
                  approveForm.resetFields();
                  setSelectedRequest(null);
                }}
                disabled={approveAdvanceMutation.isPending || approveStockMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approveAdvanceMutation.isPending || approveStockMutation.isPending}
                icon={<CheckOutlined />}
              >
                Approve Request
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={selectedRequest?.request_type === "cash_advance" ? "Reject Cash Advance" : "Reject Stock Request"}
        open={showRejectModal}
        onCancel={() => {
          setShowRejectModal(false);
          rejectForm.resetFields();
          setSelectedRequest(null);
        }}
        footer={null}
        destroyOnHidden
      >
        {selectedRequest && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg">
            <div className="font-semibold">
              {selectedRequest.user?.firstname} {selectedRequest.user?.lastname}
            </div>
            {selectedRequest.request_type === "cash_advance" ? (
              <div className="text-lg font-bold text-red-600">
                {formatCurrency(selectedRequest.amount)}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-red-600">
                  {selectedRequest.product?.name}
                </div>
                <div className="text-gray-600 text-sm">
                  Quantity: {selectedRequest.quantity}
                </div>
                <div className="text-gray-600 text-sm">
                  Branch: {selectedRequest.branch?.name}
                </div>
              </>
            )}
            {selectedRequest.reason && (
              <div className="text-gray-600 text-sm mt-1">
                Reason: {selectedRequest.reason}
              </div>
            )}
          </div>
        )}
        <Form
          form={rejectForm}
          layout="vertical"
          onFinish={handleReject}
          initialValues={{ admin_notes: "" }}
        >
          <Form.Item
            label="Rejection Reason (Optional)"
            name="admin_notes"
            rules={[
              { max: 500, message: "Reason cannot exceed 500 characters" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Provide a reason for rejection"
              maxLength={500}
              showCount
              disabled={rejectAdvanceMutation.isPending || rejectStockMutation.isPending}
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  rejectForm.resetFields();
                  setSelectedRequest(null);
                }}
                disabled={rejectAdvanceMutation.isPending || rejectStockMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                danger
                htmlType="submit"
                loading={rejectAdvanceMutation.isPending || rejectStockMutation.isPending}
                icon={<CloseOutlined />}
              >
                Reject Request
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RequestAdmin;
