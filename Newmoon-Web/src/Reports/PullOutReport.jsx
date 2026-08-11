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
  Modal,
  Descriptions,
  Input,
} from "antd";
import {
  SwapOutlined,
  ShopOutlined,
  TruckOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  SearchOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const PullOutReport = () => {
  const [loading, setLoading] = useState(false);
  const [pullOutData, setPullOutData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedSourceBranch, setSelectedSourceBranch] = useState(null);
  const [selectedDestBranch, setSelectedDestBranch] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPullOut, setSelectedPullOut] = useState(null);
  const [searchText, setSearchText] = useState("");

  const fetchPullOutReport = async (page = 1) => {
    setLoading(true);
    try {
      const [pullOutRes, branchesRes] = await Promise.all([
        api.get("/reports/pull-out", {
          params: {
            start_date: dateRange[0].format("YYYY-MM-DD"),
            end_date: dateRange[1].format("YYYY-MM-DD"),
            source_branch_id: selectedSourceBranch,
            dest_branch_id: selectedDestBranch,
            status: selectedStatus,
            page: page,
            per_page: pagination.pageSize,
          },
        }),
        api.get("/branches"),
      ]);

      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      const data = pullOutRes.data || {};
      
      setPullOutData(data.data || []);
      setSummary(data.summary || null);
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      console.error("[PullOutReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPullOutReport(1);
  }, [dateRange, selectedSourceBranch, selectedDestBranch, selectedStatus]);

  const handleTableChange = (pagination) => {
    fetchPullOutReport(pagination.current);
  };

  const handleExport = () => {
    const csvContent = [
      ["Date", "From Branch", "To Branch", "Items", "Total Value", "Requested By", "Status"],
      ...pullOutData.map(row => [
        dayjs(row.created_at).format("YYYY-MM-DD HH:mm"),
        row.source_branch,
        row.destination_branch,
        row.items_count,
        row.total_value,
        row.requested_by,
        row.status,
      ]),
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pullout_report_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  const showDetailModal = (record) => {
    setSelectedPullOut(record);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "From Branch",
      dataIndex: "source_branch",
      key: "source_branch",
      render: (branch) => (
        <Space>
          <ShopOutlined />
          <Text>{branch}</Text>
        </Space>
      ),
    },
    {
      title: "To Branch",
      dataIndex: "destination_branch",
      key: "destination_branch",
      render: (branch) => (
        <Space>
          <ShopOutlined />
          <Text>{branch}</Text>
        </Space>
      ),
    },
    {
      title: "Items",
      dataIndex: "items_count",
      key: "items_count",
      align: "center",
    },
    {
      title: "Total Value",
      dataIndex: "total_value",
      key: "total_value",
      sorter: (a, b) => a.total_value - b.total_value,
      render: (value) => (
        <Text strong style={{ color: "#52c41a" }}>
          ₱{Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Requested By",
      dataIndex: "requested_by",
      key: "requested_by",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Pending", value: "pending" },
        { text: "Approved", value: "approved" },
        { text: "In Transit", value: "in_transit" },
        { text: "Completed", value: "completed" },
        { text: "Rejected", value: "rejected" },
      ],
      render: (status) => {
        const config = {
          pending: { color: "orange", icon: <ClockCircleOutlined /> },
          approved: { color: "blue", icon: <CheckCircleOutlined /> },
          in_transit: { color: "cyan", icon: <TruckOutlined /> },
          completed: { color: "green", icon: <CheckCircleOutlined /> },
          rejected: { color: "red", icon: <CloseCircleOutlined /> },
        };
        const { color, icon } = config[status] || config.pending;
        return <Tag color={color} icon={icon}>{status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button type="link" onClick={() => showDetailModal(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const itemColumns = [
    {
      title: "Item",
      dataIndex: "item_name",
      key: "item_name",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "center",
    },
    {
      title: "Unit Cost",
      dataIndex: "unit_cost",
      key: "unit_cost",
      render: (cost) => cost !== null && cost !== undefined ? `₱${Number(cost).toFixed(2)}` : "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (total) => total !== null && total !== undefined ? `₱${Number(total).toFixed(2)}` : "-",
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
                  <SwapOutlined className="mr-2 text-blue-500" />
                  Pull-Out Report
                </Title>
                <Text type="secondary">Item transfers between branches</Text>
              </Col>
              <Col>
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={handleExport}>
                    Export CSV
                  </Button>
                  <Button type="primary" icon={<FileTextOutlined />} onClick={fetchPullOutReport} loading={loading}>
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
              <Text strong>From Branch:</Text>
              <Select
                style={{ width: 200 }}
                placeholder="All Branches"
                allowClear
                value={selectedSourceBranch}
                onChange={setSelectedSourceBranch}
              >
                {Array.isArray(branches) && branches.map((branch) => (
                  <Select.Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Select.Option>
                ))}
              </Select>
              <Text strong>To Branch:</Text>
              <Select
                style={{ width: 200 }}
                placeholder="All Branches"
                allowClear
                value={selectedDestBranch}
                onChange={setSelectedDestBranch}
              >
                {Array.isArray(branches) && branches.map((branch) => (
                  <Select.Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Select.Option>
                ))}
              </Select>
              <Text strong>Status:</Text>
              <Select
                style={{ width: 150 }}
                placeholder="All Status"
                allowClear
                value={selectedStatus}
                onChange={setSelectedStatus}
              >
                <Select.Option value="pending">Pending</Select.Option>
                <Select.Option value="approved">Approved</Select.Option>
                <Select.Option value="in_transit">In Transit</Select.Option>
                <Select.Option value="completed">Completed</Select.Option>
                <Select.Option value="rejected">Rejected</Select.Option>
              </Select>
              <Input
                placeholder="Search reference..."
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Space>
          </Card>
        </Col>

        {/* Summary Stats */}
        {summary && (
          <>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Transfers"
                  value={summary.total_transfers}
                  prefix={<SwapOutlined />}
                  styles={{ content: { color: "#1890ff" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Completed"
                  value={summary.completed}
                  prefix={<CheckCircleOutlined />}
                  styles={{ content: { color: "#52c41a" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Pending"
                  value={summary.pending}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: "#faad14" } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card variant="borderless">
                <Statistic
                  title="Total Value"
                  value={summary.total_value}
                  prefix={<DollarOutlined />}
                  styles={{ content: { color: "#722ed1" } }}
                  formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                />
              </Card>
            </Col>
          </>
        )}

        {/* Pull-Out Table */}
        <Col span={24}>
          <Card variant="borderless" title="Pull-Out Requests">
            <Table
              columns={columns}
              dataSource={pullOutData.filter(
                (item) =>
                  !searchText ||
                  item.reference_number.toLowerCase().includes(searchText.toLowerCase())
              )}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: true }}
            />
          </Card>
        </Col>
      </Row>

      {/* Detail Modal */}
      <Modal
        title="Pull-Out Request Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedPullOut && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Reference">{selectedPullOut.reference_number}</Descriptions.Item>
              <Descriptions.Item label="Date">{dayjs(selectedPullOut.created_at).format("MMM DD, YYYY HH:mm")}</Descriptions.Item>
              <Descriptions.Item label="From Branch">{selectedPullOut.source_branch}</Descriptions.Item>
              <Descriptions.Item label="To Branch">{selectedPullOut.destination_branch}</Descriptions.Item>
              <Descriptions.Item label="Requested By">{selectedPullOut.requested_by}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedPullOut.status === "completed" ? "green" : selectedPullOut.status === "pending" ? "orange" : "blue"}>
                  {selectedPullOut.status.charAt(0).toUpperCase() + selectedPullOut.status.slice(1)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Items" span={2}>{selectedPullOut.items_count}</Descriptions.Item>
              <Descriptions.Item label="Total Value" span={2}>
                <Text strong style={{ color: "#52c41a", fontSize: 18 }}>
                  ₱{Number(selectedPullOut.total_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </Descriptions.Item>
              {selectedPullOut.notes && (
                <Descriptions.Item label="Notes" span={2}>{selectedPullOut.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5}>Items</Title>
            <Table
              columns={itemColumns}
              dataSource={selectedPullOut.items || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default PullOutReport;
