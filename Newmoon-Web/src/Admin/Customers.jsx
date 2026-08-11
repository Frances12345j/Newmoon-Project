import React, { useState } from "react";
import {
  Tag, Modal, message, Button, Input, Card, Space, Typography,
  Badge, Empty, Skeleton, Descriptions, Table, Tooltip, Avatar,
} from "antd";
import {
  UserOutlined, SearchOutlined, MailOutlined, PhoneOutlined,
  ShoppingCartOutlined, DollarOutlined, TeamOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
  CreditCardOutlined, HomeOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../config/api";

const { Title, Text } = Typography;

const itemColumns = [
  {
    title: "Product",
    dataIndex: "product_name",
    key: "product_name",
    render: (val) => <Text strong>{val}</Text>,
  },
  {
    title: "Qty",
    dataIndex: "quantity",
    key: "quantity",
    width: 60,
    className: "text-center",
    render: (val) => Number(val),
  },
  {
    title: "Price",
    dataIndex: "price",
    key: "price",
    width: 100,
    className: "text-right",
    render: (val) => `₱${Number(val).toFixed(2)}`,
  },
  {
    title: "Total",
    dataIndex: "total",
    key: "total",
    width: 100,
    className: "text-right",
    render: (val) => <Text strong>₱${Number(val).toFixed(2)}</Text>,
  },
];

const paymentMethodTag = (method) => {
  const colorMap = { cash: "green", cod: "blue", gcash: "purple", card: "cyan" };
  return <Tag color={colorMap[method] || "default"}>{method?.toUpperCase() || "-"}</Tag>;
};

const statusColorMap = {
  pending: "orange",
  confirmed: "blue",
  preparing: "purple",
  out_for_delivery: "geekblue",
  delivered: "green",
  cancelled: "red",
};

function Customers() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const PAGE_SIZE = 10;

  const queryKey = ["customers", currentPage, searchTerm];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("per_page", PAGE_SIZE);
      params.append("page", currentPage);
      if (searchTerm) params.append("search", searchTerm);
      const { data } = await api.get(`/customers?${params}`);
      return data;
    },
    keepPreviousData: true,
  });

  const customers = data?.data || [];
  const pagination = data?.pagination || {};

  const { data: customerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["customer", selectedCustomer?.id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${selectedCustomer.id}`);
      return data;
    },
    enabled: !!selectedCustomer && showDetailModal,
  });

  const handleView = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const handleToggleActive = async (customer) => {
    try {
      await api.post(`/customers/${customer.id}/toggle-active`);
      message.success(`Customer ${customer.is_active ? "deactivated" : "activated"} successfully`);
      setShowDetailModal(false);
      setSelectedCustomer(null);
    } catch {
      message.error("Failed to update customer status");
    }
  };

  const listColumns = [
    {
      title: "Customer",
      key: "customer",
      width: 220,
      render: (_, r) => (
        <div className="flex items-center gap-3">
          <Avatar size={36} icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
          <div>
            <Text strong>{r.full_name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>@{r.username}</Text>
          </div>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          {r.email && <Text style={{ fontSize: 12 }}><MailOutlined className="mr-1" />{r.email}</Text>}
          {r.phone && <Text style={{ fontSize: 12 }}><PhoneOutlined className="mr-1" />{r.phone}</Text>}
        </Space>
      ),
    },
    {
      title: "Orders",
      dataIndex: "total_orders",
      key: "total_orders",
      width: 80,
      className: "text-center",
      render: (v) => <Badge count={v} showZero style={{ backgroundColor: "#1890ff" }} />,
    },
    {
      title: "Total Spent",
      dataIndex: "total_spent",
      key: "total_spent",
      width: 140,
      className: "text-right",
      render: (v) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Joined",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (v) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? new Date(v).toLocaleDateString() : "-"}
        </Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 90,
      render: (_, r) => (
        <Tag color={r.is_active ? "green" : "red"}>{r.is_active ? "Active" : "Inactive"}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      className: "text-center",
      render: (_, r) => (
        <Tooltip title="View Details">
          <Button type="primary" shape="circle" icon={<EyeOutlined />} size="small" onClick={() => handleView(r)} />
        </Tooltip>
      ),
    },
  ];

  const saleColumns = [
    { title: "Invoice", dataIndex: "invoice_number", key: "invoice_number", render: (v) => <Text code>{v || "-"}</Text> },
    { title: "Branch", dataIndex: "branch", key: "branch", render: (v) => v || "-" },
    { title: "Date", dataIndex: "sale_date", key: "sale_date", render: (v) => v || "-" },
    { title: "Payment", dataIndex: "payment_method", key: "payment_method", render: (v) => paymentMethodTag(v) },
    {
      title: "Amount",
      key: "amount",
      width: 160,
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
            Cash: ₱{Number(r.cash_collected || 0).toFixed(2)}
          </Text>
          <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
            Change: ₱{Number(r.change_given || 0).toFixed(2)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 100,
      className: "text-right",
      sorter: (a, b) => a.total - b.total,
      render: (v) => <Text strong>₱{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>,
    },
  ];

  const orderColumns = [
    { title: "Order #", dataIndex: "order_number", key: "order_number", render: (v) => <Text code>{v || "-"}</Text> },
    { title: "Branch", dataIndex: "branch", key: "branch", render: (v) => v || "-" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) => <Tag color={statusColorMap[v] || "default"}>{v || "-"}</Tag>,
    },
    { title: "Payment", dataIndex: "payment_method", key: "payment_method", render: (v) => paymentMethodTag(v) },
    {
      title: "Payment Status",
      dataIndex: "payment_status",
      key: "payment_status",
      render: (v) => <Tag color={v === "paid" ? "green" : "orange"}>{v || "-"}</Tag>,
    },
    {
      title: "GCash Ref",
      dataIndex: "gcash_reference",
      key: "gcash_reference",
      render: (v) => (v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">-</Text>),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 100,
      className: "text-right",
      sorter: (a, b) => a.total - b.total,
      render: (v) => <Text strong>₱{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>,
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 90,
      render: (v) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? new Date(v).toLocaleDateString() : "-"}
        </Text>
      ),
    },
  ];

  const expandedRowRender = (record, type) => {
    const items = record.items || [];
    if (!items.length) return <Text type="secondary" italic>No items</Text>;
    return (
      <Table
        columns={itemColumns}
        dataSource={items}
        rowKey={(_, i) => i}
        pagination={false}
        size="small"
        bordered
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3} className="text-right">
                <Text strong>{type === "sale" ? "Sale Total" : "Order Total"}:</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} className="text-right">
                <Text strong>₱{Number(record.total).toFixed(2)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    );
  };

  return (
    <div className="p-4">
      <Card variant="borderless" className="mb-4">
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <div className="flex justify-between items-center">
            <div>
              <Title level={4} style={{ margin: 0 }}>
                <TeamOutlined className="mr-2 text-blue-500" />
                Customer Data
              </Title>
              <Text type="secondary">View and manage registered customers</Text>
            </div>
          </div>
          <Input
            placeholder="Search customers..."
            prefix={<SearchOutlined />}
            allowClear
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ width: 300 }}
          />
        </Space>
      </Card>

      <Card variant="borderless">
        <Table
          columns={isLoading ? [
            { title: "Customer", key: "customer", width: 220, render: () => <div className="flex items-center gap-3"><Skeleton.Avatar active size="small" shape="circle" /><div><Skeleton.Input active size="small" style={{ width: 140, marginBottom: 6 }} /><Skeleton.Input active size="small" style={{ width: 80 }} /></div></div> },
            { title: "Contact", key: "contact", render: () => <div className="space-y-1"><Skeleton.Input active size="small" style={{ width: 160 }} /><Skeleton.Input active size="small" style={{ width: 120 }} /></div> },
            { title: "Orders", key: "total_orders", width: 80, render: () => <Skeleton.Input active size="small" style={{ width: 30 }} /> },
            { title: "Total Spent", key: "total_spent", width: 140, render: () => <Skeleton.Input active size="small" style={{ width: 80 }} /> },
            { title: "Joined", key: "created_at", width: 120, render: () => <Skeleton.Input active size="small" style={{ width: 70 }} /> },
            { title: "Status", key: "status", width: 90, render: () => <Skeleton.Input active size="small" style={{ width: 50 }} /> },
            { title: "Actions", key: "actions", width: 80, render: () => <Skeleton.Button active size="small" style={{ width: 32 }} /> },
          ] : listColumns}
          dataSource={isLoading ? Array.from({ length: 5 }).map((_, i) => ({ id: `skel-${i}` })) : customers}
          rowKey="id"
          loading={false}
          pagination={isLoading ? false : {
            current: pagination.current_page || 1,
            pageSize: PAGE_SIZE,
            total: pagination.total || 0,
            onChange: (p) => setCurrentPage(p),
            showSizeChanger: false,
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      <Modal
        title={<Space><UserOutlined /> Customer Details</Space>}
        open={showDetailModal}
        onCancel={() => { setShowDetailModal(false); setSelectedCustomer(null); }}
        footer={null}
        width={1000}
      >
        {detailLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : customerDetail ? (
<Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Card variant="borderless" size="small">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Name" span={2}>{customerDetail.customer.full_name}</Descriptions.Item>
                <Descriptions.Item label="Username">@{customerDetail.customer.username}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={customerDetail.customer.is_active ? "green" : "red"}>
                    {customerDetail.customer.is_active ? "Active" : "Inactive"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Email">{customerDetail.customer.email || "-"}</Descriptions.Item>
                <Descriptions.Item label="Phone">{customerDetail.customer.phone || "-"}</Descriptions.Item>
                <Descriptions.Item label="Address" span={2}>{customerDetail.customer.address || "-"}</Descriptions.Item>
                <Descriptions.Item label="Total Spent">
                  <Text strong style={{ color: "#52c41a" }}>
                    ₱{Number(customerDetail.customer.total_spent).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Orders / Sales">
                  {customerDetail.customer.total_orders} online • {customerDetail.customer.total_sales} in-store
                </Descriptions.Item>
                <Descriptions.Item label="Member Since">
                  {customerDetail.customer.created_at
                    ? new Date(customerDetail.customer.created_at).toLocaleDateString()
                    : "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {customerDetail.sales?.length > 0 && (
              <Card
                title={<Space><DollarOutlined /> In-Store Sales — {customerDetail.sales.length} transaction{customerDetail.sales.length > 1 ? "s" : ""}</Space>}
                variant="borderless"
                size="small"
              >
                <Table
                  columns={saleColumns}
                  dataSource={customerDetail.sales}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 800 }}
                  expandable={{
                    expandedRowRender: (r) => expandedRowRender(r, "sale"),
                    rowExpandable: (r) => (r.items || []).length > 0,
                  }}
                />
              </Card>
            )}

            {customerDetail.orders?.length > 0 && (
              <Card
                title={<Space><ShoppingCartOutlined /> Online Orders — {customerDetail.orders.length} order{customerDetail.orders.length > 1 ? "s" : ""}</Space>}
                variant="borderless"
                size="small"
              >
                <Table
                  columns={orderColumns}
                  dataSource={customerDetail.orders}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 900 }}
                  expandable={{
                    expandedRowRender: (r) => (
                      <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                        {r.delivery_address && (
                          <Text style={{ fontSize: 12 }}>
                            <HomeOutlined className="mr-1" />Deliver to: {r.delivery_address}
                          </Text>
                        )}
                        {r.gcash_reference && (
                          <Text style={{ fontSize: 12 }}>
                            <CreditCardOutlined className="mr-1" />GCash Ref: {r.gcash_reference}
                          </Text>
                        )}
                        {r.notes && <Text style={{ fontSize: 12 }} type="secondary">Notes: {r.notes}</Text>}
                        <Text style={{ fontSize: 12 }}>
                          Subtotal: ₱{Number(r.subtotal || 0).toFixed(2)}
                          {Number(r.delivery_fee || 0) > 0 && ` • Delivery Fee: ₱${Number(r.delivery_fee).toFixed(2)}`}
                        </Text>
                        {expandedRowRender(r, "order")}
                      </Space>
                    ),
                    rowExpandable: (r) => (r.items || []).length > 0 || !!r.delivery_address || !!r.gcash_reference,
                  }}
                />
              </Card>
            )}

            {!customerDetail.sales?.length && !customerDetail.orders?.length && (
              <Empty description="No sales or orders found for this customer" />
            )}

            <Button
              type={customerDetail.customer.is_active ? "primary" : "default"}
              danger={customerDetail.customer.is_active}
              icon={customerDetail.customer.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleActive(customerDetail.customer)}
            >
              {customerDetail.customer.is_active ? "Deactivate Customer" : "Activate Customer"}
            </Button>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}

export default Customers;
