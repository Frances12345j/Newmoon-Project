import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, message, Tag, Space, Select, Tooltip } from "antd";
import { 
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  InboxOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "../config/api";

const { TextArea } = Input;

function PullOutAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPullOut, setSelectedPullOut] = useState(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch all pull-outs with server-side pagination + status filter
  const { data: pullOutsData, isLoading: pullOutsLoading, refetch: refetchPullOuts } = useQuery({
    queryKey: ['pullOutsAll', currentPage, pageSize, statusFilter],
    queryFn: () => {
      const params = { page: currentPage, per_page: pageSize };
      if (statusFilter !== "all") params.status = statusFilter;
      return api.get("/pull-outs/getall", { params });
    },
  });

  const pullOuts = pullOutsData?.data?.data || [];
  const stats = pullOutsData?.data?.stats || {};
  const paginationMeta = pullOutsData?.data?.pagination || {};

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/pull-outs/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Pull-out approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve pull-out");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/pull-outs/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Pull-out rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject pull-out");
    },
  });

  const handleApprove = (values) => {
    approveMutation.mutate({
      id: selectedPullOut.id,
      adminNotes: values.admin_notes || null,
    });
  };

  const handleReject = (values) => {
    rejectMutation.mutate({
      id: selectedPullOut.id,
      adminNotes: values.admin_notes || null,
    });
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
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div>
          <div className="font-semibold">{record.product?.name}</div>
          <div className="text-gray-500 text-xs">SKU: {record.product?.sku}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <div className="font-semibold">{record.branch?.name}</div>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (quantity) => (
        <span className="font-semibold">{quantity}</span>
      ),
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes) => notes || <span className="text-gray-400">-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "Pulled Out At",
      dataIndex: "pulled_out_at",
      key: "pulled_out_at",
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
                    setSelectedPullOut(record);
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
                    setSelectedPullOut(record);
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

  // Statistics from server (unpaginated, full dataset)

  const handleRefresh = () => {
    refetchPullOuts();
  };

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
                <InboxOutlined className="mr-2" />
                Pull-Out Management
              </h1>
              <p className="text-white/80 text-sm">Approve or reject product pull-out requests</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Pull-Outs</p>
              <p className="text-white font-bold text-xl">{stats.total || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Pending</p>
              <p className="text-white font-bold text-xl">{stats.pending || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Approved</p>
              <p className="text-white font-bold text-xl">{stats.approved || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Quantity</p>
              <p className="text-white font-bold text-xl">{stats.total_quantity || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - FoodMeal Style */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <Space>
          <span className="text-[#1A237E] font-medium text-sm">Filter by status:</span>
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
            style={{ width: 150 }}
            className="rounded-xl"
          >
            <Select.Option value="all">All</Select.Option>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={pullOutsLoading}
            className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Requests Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <InboxOutlined className="mr-2 text-[#E53935]" />
              All Pull-Outs
            </h2>
            <p className="text-sm text-gray-500 mt-1">Review and process staff pull-out requests</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {paginationMeta.total || pullOuts.length} pull-out(s)
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#E3F2FD] shadow-sm">
        <Table
          columns={columns}
          dataSource={pullOuts}
          rowKey="id"
          loading={pullOutsLoading}
          pagination={{
            current: paginationMeta.current_page || 1,
            pageSize: pageSize,
            total: paginationMeta.total || 0,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} pull-outs`,
          }}
          locale={{
            emptyText: (
              <div className="py-8 text-center">
                <InboxOutlined className="text-4xl text-gray-300 mb-2" />
                <p className="text-gray-500">No pull-outs found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filter</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Approve Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <CheckOutlined className="mr-2 text-[#3f8600]" />
            <span className="text-[#1A237E] font-bold">Approve Pull-Out</span>
          </span>
        }
        open={showApproveModal}
        onCancel={() => {
          setShowApproveModal(false);
          approveForm.resetFields();
          setSelectedPullOut(null);
        }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selectedPullOut && (
          <div className="mb-4 p-4 rounded-xl bg-[#E3F2FD]">
            <div className="font-semibold text-[#1A237E]">
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold text-[#3f8600]">
              {selectedPullOut.product?.name}
            </div>
            <div className="text-gray-600 text-sm">
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-gray-600 text-sm">
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.notes && (
              <div className="text-gray-600 text-sm mt-1">
                Notes: {selectedPullOut.notes}
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
            label={<span className="text-[#1A237E] font-medium">Admin Notes (Optional)</span>}
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
              disabled={approveMutation.isPending}
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#E3F2FD]">
            <p className="text-xs text-[#1A237E] mb-0">
              <InfoCircleOutlined className="mr-1" />
              This action will approve the pull-out request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowApproveModal(false);
                  approveForm.resetFields();
                  setSelectedPullOut(null);
                }}
                disabled={approveMutation.isPending}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approveMutation.isPending}
                icon={<CheckOutlined />}
                className="rounded-xl bg-gradient-to-br from-[#3f8600] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(63,134,0,0.3)] hover:opacity-90"
              >
                Approve Pull-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <CloseOutlined className="mr-2 text-[#E53935]" />
            <span className="text-[#1A237E] font-bold">Reject Pull-Out</span>
          </span>
        }
        open={showRejectModal}
        onCancel={() => {
          setShowRejectModal(false);
          rejectForm.resetFields();
          setSelectedPullOut(null);
        }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selectedPullOut && (
          <div className="mb-4 p-4 rounded-xl bg-[#FFEBEE]">
            <div className="font-semibold text-[#1A237E]">
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold text-[#E53935]">
              {selectedPullOut.product?.name}
            </div>
            <div className="text-gray-600 text-sm">
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-gray-600 text-sm">
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.notes && (
              <div className="text-gray-600 text-sm mt-1">
                Notes: {selectedPullOut.notes}
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
            label={<span className="text-[#1A237E] font-medium">Rejection Reason (Optional)</span>}
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
              disabled={rejectMutation.isPending}
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#FFEBEE]">
            <p className="text-xs text-[#E53935] mb-0">
              <InfoCircleOutlined className="mr-1" />
              This action will reject the pull-out request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  rejectForm.resetFields();
                  setSelectedPullOut(null);
                }}
                disabled={rejectMutation.isPending}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                danger
                htmlType="submit"
                loading={rejectMutation.isPending}
                icon={<CloseOutlined />}
                className="rounded-xl"
              >
                Reject Pull-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PullOutAdmin;
