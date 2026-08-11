import React, { useState } from "react";
import {
  Tag, Modal, message, Button, Input, Select, Card, Space, Typography,
  Badge, Empty, Skeleton, Descriptions, Table, Tooltip, DatePicker, Row, Col,
} from "antd";
import {
  SearchOutlined, CalendarOutlined, CheckCircleOutlined,
  CloseCircleOutlined, EyeOutlined, ShopOutlined, UserOutlined,
  UndoOutlined, ShoppingCartOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "../config/api";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const statusConfig = {
  pending: { color: "orange", label: "Pending" },
  confirmed: { color: "blue", label: "Confirmed" },
  ready: { color: "green", label: "Ready for Pickup" },
  picked_up: { color: "cyan", label: "Picked Up" },
  cancelled: { color: "red", label: "Cancelled" },
};

const nextAction = (status) => {
  switch (status) {
    case "pending": return { action: "confirm", label: "Confirm", color: "blue" };
    case "confirmed": return { action: "mark-ready", label: "Mark Ready", color: "green" };
    case "ready": return { action: "mark-picked-up", label: "Mark Picked Up", color: "cyan" };
    default: return null;
  }
};

function Reservations() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ status: null, branch_id: null });
  const [dateRange, setDateRange] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const params = new URLSearchParams();
  params.append("per_page", "5");
  params.append("page", page);
  if (filters.status) params.append("status", filters.status);
  if (filters.branch_id) params.append("branch_id", filters.branch_id);
  if (search) params.append("search", search);
  if (dateRange?.[0]) params.append("date_from", dateRange[0].format("YYYY-MM-DD"));
  if (dateRange?.[1]) params.append("date_to", dateRange[1].format("YYYY-MM-DD"));

  const { data: listData, isLoading } = useQuery({
    queryKey: ["admin-reservations", params.toString()],
    queryFn: async () => {
      const { data } = await api.get(`/admin/reservations?${params}`);
      return data;
    },
  });

  const reservations = listData?.data || [];
  const pagination = listData?.pagination || listData?.meta || {};

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data } = await api.get("/branches");
      const branchesData = data?.data;
      return Array.isArray(branchesData) ? branchesData : (Array.isArray(data) ? data : []);
    },
    staleTime: 5 * 60 * 1000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }) => {
      const { data } = await api.post(`/admin/reservations/${id}/${action}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reservations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reservation"] });
      message.success("Reservation updated");
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to update reservation");
    },
  });

  const handleAction = (id, action) => {
    statusMutation.mutate({ id, action });
  };

  const handleView = async (record) => {
    setSelected(record);
    setShowDetail(true);
  };

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-reservation", selected?.id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/reservations/${selected.id}`);
      return data;
    },
    enabled: !!selected && showDetail,
  });

  const columns = [
    {
      title: "Reservation #",
      dataIndex: "reservation_number",
      key: "reservation_number",
      width: 180,
      render: (v) => <Text code>{v}</Text>,
    },
    {
      title: "Customer",
      key: "customer",
      width: 160,
      render: (_, r) => {
        const name = r.user ? `${r.user.firstname || ""} ${r.user.lastname || ""}`.trim() : "-";
        return (
          <Space>
            <UserOutlined />
            <Text>{name || "-"}</Text>
          </Space>
        );
      },
    },
    {
      title: "Branch",
      key: "branch",
      width: 130,
      render: (_, r) => (
        <Space>
          <ShopOutlined />
          <Text>{r.branch?.name || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "Pickup Date",
      dataIndex: "pickup_date",
      key: "pickup_date",
      width: 110,
      render: (v) => (v ? dayjs(v).format("MMM DD, YYYY") : "-"),
    },
    {
      title: "Items",
      key: "items",
      width: 60,
      className: "text-center",
      render: (_, r) => {
        const count = r.items ? (Array.isArray(r.items) ? r.items.length : 0) : 0;
        return <Badge count={count} showZero style={{ backgroundColor: "#722ed1" }} />;
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 100,
      className: "text-right",
      render: (v) => (
        <Text strong>₱{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (v) => {
        const cfg = statusConfig[v] || { color: "default", label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 280,
      render: (_, r) => {
        const next = nextAction(r.status);
        return (
          <Space size="small">
            <Tooltip title="View Details">
              <Button type="primary" shape="circle" icon={<EyeOutlined />} size="small" onClick={() => handleView(r)} />
            </Tooltip>
            {next && (
              <Button
                type="primary"
                size="small"
                style={{ backgroundColor: next.color, borderColor: next.color }}
                loading={statusMutation.isPending}
                onClick={() => handleAction(r.id, next.action)}
              >
                {next.label}
              </Button>
            )}
            {["pending", "confirmed"].includes(r.status) && (
              <Button danger size="small" icon={<CloseCircleOutlined />} onClick={() => handleAction(r.id, "cancel")}>
                Cancel
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const itemColumns = [
    { title: "Product Name", dataIndex: "name", key: "name", render: (v) => <Text strong>{v}</Text> },
    { title: "Qty", dataIndex: "quantity", key: "quantity", width: 60, className: "text-center", render: (v) => Number(v) },
    { title: "Price", dataIndex: "price", key: "price", width: 100, className: "text-right", render: (v) => `₱${Number(v).toFixed(2)}` },
    { title: "Total", key: "line_total", width: 100, className: "text-right", render: (_, r) => <Text strong>₱${(Number(r.price) * Number(r.quantity)).toFixed(2)}</Text> },
  ];

  return (
    <div className="p-4">
      <Card variant="borderless" className="mb-4">
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <CalendarOutlined className="mr-2 text-blue-500" />
              Reservation Management
            </Title>
            <Text type="secondary">Approve, confirm, and manage customer reservations</Text>
          </div>

          <Row gutter={[12, 12]} align="middle">
            <Col>
              <Input
                placeholder="Search by # or customer..."
                prefix={<SearchOutlined />}
                allowClear
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ width: 240 }}
              />
            </Col>
            <Col>
              <Select
                placeholder="All Statuses"
                allowClear
                style={{ width: 160 }}
                value={filters.status}
                onChange={(v) => { setFilters((p) => ({ ...p, status: v })); setPage(1); }}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "confirmed", label: "Confirmed" },
                  { value: "ready", label: "Ready for Pickup" },
                  { value: "picked_up", label: "Picked Up" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            </Col>
            <Col>
              <Select
                placeholder="All Branches"
                allowClear
                style={{ width: 180 }}
                value={filters.branch_id}
                onChange={(v) => { setFilters((p) => ({ ...p, branch_id: v })); setPage(1); }}
                options={(Array.isArray(branches) ? branches : []).map((b) => ({ value: b.id, label: b.name }))}
              />
            </Col>
            <Col>
              <RangePicker
                value={dateRange}
                onChange={(v) => { setDateRange(v); setPage(1); }}
              />
            </Col>
          </Row>
        </Space>
      </Card>

      <Card variant="borderless">
        <Table
          columns={columns}
          dataSource={reservations}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: pagination.current_page || pagination.currentPage || 1,
            pageSize: pagination.per_page || pagination.perPage || 5,
            total: pagination.total || 0,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title={<Space><EyeOutlined /> Reservation Details</Space>}
        open={showDetail}
        onCancel={() => { setShowDetail(false); setSelected(null); }}
        footer={null}
        width={700}
      >
        {detailLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : detailData ? (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Reservation #" span={2}>
                <Text code>{detailData.reservation_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Customer">
                {detailData.user
                  ? `${detailData.user.firstname || ""} ${detailData.user.lastname || ""}`.trim()
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={(statusConfig[detailData.status] || {}).color}>
                  {(statusConfig[detailData.status] || {}).label || detailData.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Branch">{detailData.branch?.name || "-"}</Descriptions.Item>
              <Descriptions.Item label="Pickup Date">
                {detailData.pickup_date ? dayjs(detailData.pickup_date).format("MMM DD, YYYY") : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Subtotal">
                ₱{Number(detailData.subtotal || 0).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong>₱{Number(detailData.total || 0).toFixed(2)}</Text>
              </Descriptions.Item>
              {detailData.notes && (
                <Descriptions.Item label="Notes" span={2}>{detailData.notes}</Descriptions.Item>
              )}
              <Descriptions.Item label="Created">
                {detailData.created_at ? dayjs(detailData.created_at).format("MMM DD, YYYY h:mm A") : "-"}
              </Descriptions.Item>
            </Descriptions>

            {detailData.items && detailData.items.length > 0 && (
              <Card
                title={<Space><ShoppingCartOutlined /> Items</Space>}
                variant="borderless"
                size="small"
              >
                <Table
                  columns={itemColumns}
                  dataSource={detailData.items}
                  rowKey={(_, i) => i}
                  pagination={false}
                  size="small"
                  bordered
                  summary={() => (
                    <Table.Summary>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3} className="text-right">
                          <Text strong>Total:</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} className="text-right">
                          <Text strong>₱{Number(detailData.total || 0).toFixed(2)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              </Card>
            )}

            <Space>
              {nextAction(detailData.status) && (
                <Button
                  type="primary"
                  onClick={() => {
                    handleAction(detailData.id, nextAction(detailData.status).action);
                    setShowDetail(false);
                  }}
                >
                  {nextAction(detailData.status).label}
                </Button>
              )}
              {["pending", "confirmed"].includes(detailData.status) && (
                <Button danger onClick={() => { handleAction(detailData.id, "cancel"); setShowDetail(false); }}>
                  Cancel Reservation
                </Button>
              )}
            </Space>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}

export default Reservations;
