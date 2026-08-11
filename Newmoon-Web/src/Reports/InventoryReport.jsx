import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Table,
  Select,
  Button,
  Space,
  Typography,
  Statistic,
  Tag,
  Tooltip,
  Progress,
  Input,
  Alert,
} from "antd";
import {
  InboxOutlined,
  WarningOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  SearchOutlined,
  StockOutlined,
} from "@ant-design/icons";
import { api } from "../config/api";

const { Text, Title } = Typography;

const InventoryReport = () => {
  const [loading, setLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState([]);
  const [movements, setMovements] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [categories, setCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [summary, setSummary] = useState({ total_items: 0, total_value: 0, low_stock_items: 0, out_of_stock_items: 0, total_products: 0 });

  const fetchInventoryReport = async (page = 1) => {
    setLoading(true);
    try {
      const [inventoryRes, branchesRes] = await Promise.all([
        api.get("/reports/inventory", {
          params: {
            branch_id: selectedBranch,
            page: page,
            per_page: pagination.pageSize,
          },
        }),
        api.get("/branches"),
      ]);

      const inventory = inventoryRes.data || {};
      
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : (branchesRes.data?.data || []));
      setInventoryData(inventory.data || []);
      setMovements(inventory.movements || []);
      setLowStockItems(inventory.data?.filter(item => item.is_low_stock) || []);
      setSummary(inventory.summary || {});
      if (inventory.pagination) {
        setPagination({
          current: inventory.pagination.current_page,
          pageSize: inventory.pagination.per_page,
          total: inventory.pagination.total,
        });
      }
    } catch (err) {
      console.error("[InventoryReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryReport(1);
  }, [selectedCategory, selectedBranch]);

  const handleTableChange = (pagination) => {
    fetchInventoryReport(pagination.current);
  };

  const handleExport = () => {
    const csvContent = [
      ["Item", "Category", "Branch", "Current Stock", "Reorder Level", "Unit Cost", "Total Value", "Status"],
      ...inventoryData.map(item => [
        item.name,
        item.category_name,
        item.branch_name,
        item.current_stock,
        item.reorder_level,
        item.unit_cost,
        item.total_value,
        item.status,
      ]),
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const stockColumns = [
    {
      title: "Item",
      dataIndex: "name",
      key: "name",
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value, record) =>
        record.name.toLowerCase().includes(value.toLowerCase()) ||
        record.sku?.toLowerCase().includes(value.toLowerCase()),
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.sku}</Text>
        </div>
      ),
    },

    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
    },
    {
      title: "Stock Level",
      dataIndex: "current_stock",
      key: "current_stock",
      sorter: (a, b) => a.current_stock - b.current_stock,
      render: (stock, record) => {
        const percentage = (stock / record.reorder_level) * 100;
        const status = stock <= record.reorder_level ? "exception" : stock <= record.reorder_level * 2 ? "normal" : "success";
        return (
          <div>
            <Progress
              percent={Math.min(100, percentage)}
              status={status}
              size="small"
              format={() => stock}
            />
          </div>
        );
      },
    },
    {
      title: "Reorder Level",
      dataIndex: "reorder_level",
      key: "reorder_level",
      align: "center",
    },
    {
      title: "Unit Cost",
      dataIndex: "unit_cost",
      key: "unit_cost",
      render: (cost) => {
        const numCost = Number(cost);
        return cost !== null && cost !== undefined && !Number.isNaN(numCost) ? `₱${numCost.toFixed(2)}` : "-";
      },
    },
    {
      title: "Total Value",
      dataIndex: "total_value",
      key: "total_value",
      sorter: (a, b) => a.total_value - b.total_value,
      render: (value) => {
        const numValue = Number(value);
        return value !== null && value !== undefined && !Number.isNaN(numValue) ? (
          <Text strong style={{ color: "#52c41a" }}>
            ₱{numValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        ) : "-";
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const config = {
          "In Stock": { color: "green", icon: <StockOutlined /> },
          "Low Stock": { color: "orange", icon: <WarningOutlined /> },
          "Out of Stock": { color: "red", icon: <WarningOutlined /> },
        };
        const { color, icon } = config[status] || config["In Stock"];
        return <Tag color={color} icon={icon}>{status}</Tag>;
      },
    },
  ];

  const movementColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: "Item",
      dataIndex: "item_name",
      key: "item_name",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "Type",
      dataIndex: "movement_type",
      key: "movement_type",
      render: (type) => {
        const isIn = type.toLowerCase() === "in";
        return (
          <Tag color={isIn ? "green" : "red"} icon={isIn ? <RiseOutlined /> : <FallOutlined />}>
            {type.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (qty, record) => (
        <Text style={{ color: record.movement_type.toLowerCase() === "in" ? "#52c41a" : "#ff4d4f" }}>
          {record.movement_type.toLowerCase() === "in" ? "+" : "-"}{qty}
        </Text>
      ),
    },
    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
    },
    {
      title: "Reference",
      dataIndex: "reference",
      key: "reference",
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      ellipsis: true,
    },
  ];

  // Stats — from backend summary (all items, not just current page)
  const totalItems = summary.total_products || 0;
  const totalValue = summary.total_value || 0;
  const lowStockCount = summary.low_stock_items || 0;
  const outOfStockCount = summary.out_of_stock_items || 0;

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <Card variant="borderless">
            <Row justify="space-between" align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>
                  <InboxOutlined className="mr-2 text-blue-500" />
                  Inventory Report
                </Title>
                <Text type="secondary">Stock levels, movements, and alerts</Text>
              </Col>
              <Col>
                <Space>
                  <Button icon={<DownloadOutlined />} onClick={handleExport}>
                    Export CSV
                  </Button>
                  <Button type="primary" icon={<StockOutlined />} onClick={fetchInventoryReport} loading={loading}>
                    Refresh
                  </Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Low Stock Alert */}
        {lowStockCount > 0 && (
          <Col span={24}>
            <Alert
              message={`${lowStockCount} items are below reorder level`}
              description="These items need to be restocked soon to avoid stockouts."
              type="warning"
              icon={<WarningOutlined />}
              showIcon
              closable
            />
          </Col>
        )}

        {/* Filters */}
        <Col span={24}>
          <Card variant="borderless" size="small">
            <Space wrap>
              <Text strong>Branch:</Text>
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
              <Input
                placeholder="Search items..."
                prefix={<SearchOutlined />}
                style={{ width: 250 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </Space>
          </Card>
        </Col>

        {/* Stats Cards */}
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title="Total Items"
              value={totalItems}
              prefix={<InboxOutlined />}
              styles={{ content: { color: "#1890ff" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title="Total Value"
              value={totalValue}
              prefix={<StockOutlined />}
              styles={{ content: { color: "#52c41a" } }}
              formatter={(value) => `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title="Low Stock"
              value={lowStockCount}
              prefix={<WarningOutlined />}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card variant="borderless">
            <Statistic
              title="Out of Stock"
              value={outOfStockCount}
              prefix={<WarningOutlined />}
              styles={{ content: { color: "#ff4d4f" } }}
            />
          </Card>
        </Col>

        {/* Stock Level Table */}
        <Col span={24}>
          <Card variant="borderless" title="Current Stock Levels">
            <Table
              columns={stockColumns}
              dataSource={inventoryData}
              rowKey="id"
              loading={loading}
              pagination={pagination}
              onChange={handleTableChange}
              scroll={{ x: true }}
            />
          </Card>
        </Col>

        {/* Stock Movements */}
        <Col span={24}>
          <Card variant="borderless" title="Recent Stock Movements">
            <Table
              columns={movementColumns}
              dataSource={movements}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showTotal: (total) => `Total ${total} movements`,
              }}
              scroll={{ x: true }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default InventoryReport;
