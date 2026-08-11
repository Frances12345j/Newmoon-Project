import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Modal, Form, Input, Statistic, Row, Col, Tag, Space, message, Badge } from "antd";
import {
  PlusOutlined,
  ShopOutlined,
  StockOutlined,
  ProductOutlined,
  TeamOutlined,
  ReloadOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  FireOutlined,
  StarOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPesoSign } from '@fortawesome/free-solid-svg-icons';
import { api } from "../config/api";
import { getCache, setCache, invalidateCache } from "../utils/cache";

function Dashboard() {
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loadError, setLoadError] = useState("");
  const [lowStockItems, setLowStockItems] = useState([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [dismissedLowStock, setDismissedLowStock] = useState(() => {
    return sessionStorage.getItem('dismissed_low_stock') === 'true';
  });
  const [addBranchForm] = Form.useForm();

  useEffect(() => {
    const updatePHTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const phTime = new Date(utc + 8 * 60 * 60 * 1000);
      setCurrentTime(phTime);
    };
    updatePHTime();
    const timer = setInterval(updatePHTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboardData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setLoadError("");

    try {
      const cachedBranches = forceRefresh ? null : getCache('branches');
      const cachedStaff = forceRefresh ? null : getCache('staff');
      const cachedSales = forceRefresh ? null : getCache('sales');
      const cachedProducts = forceRefresh ? null : getCache('products');

      if (cachedBranches?.length && cachedStaff?.length && cachedSales?.length && cachedProducts?.length) {
        setBranches(cachedBranches);
        setStaff(cachedStaff);
        setSales(cachedSales);
        setProducts(cachedProducts);
        setLoading(false);
        return;
      }

      const results = await Promise.allSettled([
        cachedBranches ? Promise.resolve({ data: cachedBranches }) : api.get("/branches"),
        cachedStaff ? Promise.resolve({ data: cachedStaff }) : api.get("/staff"),
        cachedSales ? Promise.resolve({ data: cachedSales }) : api.get("/sales"),
        cachedProducts ? Promise.resolve({ data: cachedProducts }) : api.get("/products"),
      ]);

      const labels = ["GET /branches", "GET /staff", "GET /sales", "GET /products"];
      const rejectedIdx = results.findIndex((r) => r.status === "rejected");
      if (rejectedIdx !== -1) {
        const reason = results[rejectedIdx].reason;
        const status = reason?.response?.status;
        const backendMessage = reason?.response?.data?.message || reason?.response?.data?.error || reason?.message;

        if (status === 401 || status === 419) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("role");
          localStorage.removeItem("isLoggedIn");
          navigate("/");
          return;
        }

        throw new Error(
          `${labels[rejectedIdx]} failed` +
            (status ? ` (HTTP ${status})` : "") +
            (backendMessage ? `: ${backendMessage}` : "")
        );
      }

      const branchesRes = results[0].value;
      const staffRes = results[1].value;
      const salesRes = results[2].value;
      const productsRes = results[3].value;

      const staffRows = (staffRes.data?.data || []).map((s) => {
        const assignments = Array.isArray(s.branchAssignments)
          ? s.branchAssignments
          : Array.isArray(s.branch_assignments)
            ? s.branch_assignments
            : [];
        const branchId = assignments?.[0]?.branch_id || s.branch_id || s.branchId || null;
        return { ...s, branch_id: branchId };
      });

      const branchesData = branchesRes.data?.data || [];
      const staffData = staffRows;
      const salesData = salesRes.data?.data || [];
      const productsData = productsRes.data?.data || [];

      setBranches(branchesData);
      setStaff(staffData);
      setSales(salesData);
      setProducts(productsData);

      const lowStock = [];
      for (const product of productsData) {
        if (!product.product_stocks) continue;
        for (const stock of product.product_stocks) {
          const qty = parseQuantity(stock?.quantity);
          const minStock = parseInt(stock?.minimum_stock, 10) || 0;
          if (minStock > 0 && qty > 0 && qty < minStock) {
            const branch = branchesData.find(b => String(b.id) === String(stock.branch_id));
            lowStock.push({
              product_name: product.name,
              product_sku: product.sku,
              branch_name: branch?.name || `Branch #${stock.branch_id}`,
              quantity: qty,
              minimum_stock: minStock,
            });
          }
        }
      }
      setLowStockItems(lowStock);
      if (lowStock.length > 0 && !dismissedLowStock) {
        setShowLowStockModal(true);
      }

      setCache('branches', branchesData);
      setCache('staff', staffData);
      setCache('sales', salesData);
      setCache('products', productsData);
    } catch (err) {
      const msg = err?.message || "Failed to load dashboard data from backend.";
      setLoadError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const parseQuantity = (value) => {
    if (value === null || value === undefined || value === "") return 0;
    const n = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const getBranchProductsCount = (branchId) => {
    const target = String(branchId);
    const total = products.reduce((sum, product) => {
      if (!product.product_stocks) return sum;
      const stock = product.product_stocks.find((s) => String(s.branch_id) === target);
      return sum + parseQuantity(stock?.quantity);
    }, 0);
    return Math.round(total);
  };

  const getBranchProductCount = (branchId) => {
    const target = String(branchId);
    return products.filter((product) => {
      if (!product.product_stocks) return false;
      return product.product_stocks.some((s) => String(s.branch_id) === target);
    }).length;
  };

  const getBranchStaffCount = (branchId) => {
    const target = String(branchId);
    return staff.filter((s) => {
      const assignments = Array.isArray(s.branchAssignments)
        ? s.branchAssignments
        : Array.isArray(s.branch_assignments)
          ? s.branch_assignments
          : [];
      if (assignments.length > 0) {
        return assignments.some((a) => {
          if (!a) return false;
          if (a.is_active === false) return false;
          return a.branch_id != null && String(a.branch_id) === target;
        });
      }
      if (s.branch_id == null || s.branch_id === "") return false;
      return String(s.branch_id) === target;
    }).length;
  };

  const handleAddBranch = async (values) => {
    try {
      const { data } = await api.post("/branches", {
        name: values.name,
        code: values.code,
        address: values.address,
      });
      setBranches((prev) => [...prev, data]);
      addBranchForm.resetFields();
      setIsModalOpen(false);
      invalidateCache('branches');
      message.success("Branch created successfully!");
    } catch (err) {
      message.error(err?.response?.data?.message || "Failed to create branch");
    }
  };

  const totalSales = sales.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);
  const todaySales = sales.filter(sale => {
    const today = new Date();
    const saleDate = new Date(sale.created_at);
    return saleDate.toDateString() === today.toDateString();
  }).reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

  const formatCurrency = (amount) => `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

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
                <FireOutlined className="mr-2" />
                Dashboard Overview
              </h1>
              <p className="text-white/80 text-sm">Welcome back! Here's your business at a glance</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm px-4 py-2 rounded-xl">
              <p className="text-white/70 text-xs">Philippines Time</p>
              <p className="text-white font-semibold text-lg">
                {currentTime.toLocaleTimeString('en-PH', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-white/60 text-[10px]">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Branches</p>
              <p className="text-white font-bold text-xl">{branches.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Staff</p>
              <p className="text-white font-bold text-xl">{staff.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Today's Sales</p>
              <p className="text-white font-bold text-xl">{formatCurrency(todaySales)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Sales</p>
              <p className="text-white font-bold text-xl">{formatCurrency(totalSales)}</p>
            </div>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6">{loadError}</div>
      )}

      {/* Action Buttons - FoodMeal Style */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => loadDashboardData(true)} 
            loading={loading}
            className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]"
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => { addBranchForm.resetFields(); setIsModalOpen(true); }}
            className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
          >
            Add Branch
          </Button>
          {lowStockItems.length > 0 && (
            <Tag 
              color="red" 
              className="cursor-pointer px-3 py-1 rounded-full"
              onClick={() => setShowLowStockModal(true)}
            >
              <WarningOutlined className="mr-1" />
              {lowStockItems.length} low stock items
            </Tag>
          )}
        </Space>
      </Card>

      {/* Branches Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <ShopOutlined className="mr-2 text-[#E53935]" />
              Branches
            </h2>
            <p className="text-sm text-gray-500 mt-1">Manage and monitor each branch's performance</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            Total: {branches.length} branches
          </Tag>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E53935] mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading branches...</p>
          </div>
        </div>
      ) : branches.length === 0 ? (
        <Card className="text-center py-12 rounded-xl border border-[#E3F2FD]">
          <ShopOutlined className="text-6xl text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg mb-2">No branches yet</p>
          <p className="text-gray-400">Click the "Add Branch" button to get started</p>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {branches.map((branch) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={branch.id}>
              <Card
                hoverable
                className="h-full rounded-xl border border-[#E3F2FD] shadow-sm hover:shadow-[0_8px_25px_rgba(229,57,53,0.15)] transition-all duration-300"
                cover={
                  <div className="px-4 pt-6 pb-4 text-center bg-gradient-to-br from-[#E53935] to-[#1A237E]">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto border-2 border-white/30">
                      <ShopOutlined className="text-3xl text-white" />
                    </div>
                  </div>
                }
              >
                <div className="text-center mb-4">
                  <h3 className="font-bold text-lg text-[#1A237E]">{branch.name}</h3>
                  {branch.code && (
                    <Tag className="mt-1 text-xs bg-[#E3F2FD] text-[#1A237E] border-none">
                      #{branch.code}
                    </Tag>
                  )}
                  {branch.address && <p className="text-gray-500 text-sm mt-1">{branch.address}</p>}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-[#E3F2FD]/30">
                    <span className="text-gray-500"><StockOutlined className="mr-1" /> Stock</span>
                    <Badge 
                      count={getBranchProductsCount(branch.id)} 
                      className="bg-gradient-to-br from-[#E53935] to-[#1A237E]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-[#FFEBEE]/30">
                    <span className="text-gray-500"><TeamOutlined className="mr-1" /> Staff</span>
                    <Badge 
                      count={getBranchStaffCount(branch.id)} 
                      className="bg-[#1A237E]"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-[#E3F2FD]/20">
                    <span className="text-gray-500"><ProductOutlined className="mr-1" /> Products</span>
                    <Badge 
                      count={getBranchProductCount(branch.id)} 
                      className="bg-[#1565C0]"
                    />
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Low Stock Alert Modal - FoodMeal Style */}
      <Modal
        title={
          <span className="text-[#E53935]">
            <WarningOutlined className="mr-2" />
            Low Stock Alert
          </span>
        }
        open={showLowStockModal}
        onCancel={() => setShowLowStockModal(false)}
        footer={
          <Space>
            <Button onClick={() => {
              setDismissedLowStock(true);
              sessionStorage.setItem('dismissed_low_stock', 'true');
              setShowLowStockModal(false);
            }}>
              Dismiss
            </Button>
            <Button 
              type="primary" 
              danger 
              onClick={() => {
                setShowLowStockModal(false);
                navigate('/inventory');
              }}
              className="bg-[#E53935] border-[#E53935] rounded-lg"
            >
              View All
            </Button>
          </Space>
        }
        width={600}
        className="rounded-2xl"
      >
        <p className="text-gray-500 mb-4">
          {lowStockItems.length} product{lowStockItems.length > 1 ? 's are' : ' is'} running low on stock
        </p>
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">Product</th>
                <th className="text-left py-2 text-gray-500 font-medium">Branch</th>
                <th className="text-right py-2 text-gray-500 font-medium">Qty</th>
                <th className="text-right py-2 text-gray-500 font-medium">Min</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-gray-800">
                    <div className="flex items-center gap-2">
                      <ShoppingCartOutlined className="text-gray-400" />
                      <span className="truncate max-w-[160px]">{item.product_name}</span>
                    </div>
                  </td>
                  <td className="py-2 text-gray-600">{item.branch_name}</td>
                  <td className="py-2 text-right font-semibold text-[#E53935]">{item.quantity}</td>
                  <td className="py-2 text-right text-gray-500">{item.minimum_stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Add Branch Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <PlusOutlined className="mr-2 text-[#E53935]" />
            <span className="text-[#1A237E] font-bold">Add New Branch</span>
          </span>
        }
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); addBranchForm.resetFields(); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={addBranchForm} layout="vertical" onFinish={handleAddBranch}>
          <Form.Item 
            label={<span className="text-[#1A237E] font-medium">Branch Name</span>}
            name="name" 
            rules={[{ required: true, message: "Branch name is required" }]}
          >
            <Input 
              placeholder="Enter branch name (e.g., 'Downtown Branch')" 
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item 
            label={<span className="text-[#1A237E] font-medium">Branch Code</span>}
            name="code" 
            rules={[{ required: true, message: "Branch code is required" }]}
          >
            <Input 
              placeholder="Enter branch code (e.g., MAIN)" 
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item 
            label={<span className="text-[#1A237E] font-medium">Branch Address</span>}
            name="address" 
            rules={[{ required: true, message: "Branch address is required" }]}
          >
            <Input.TextArea 
              placeholder="Enter branch address (e.g., 123 Main St, City)" 
              rows={2}
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#E3F2FD]">
            <p className="text-xs text-[#1A237E] mb-0">
              <InfoCircleOutlined className="mr-1" />
              This information will be visible to all staff members and customers
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button 
                onClick={() => { setIsModalOpen(false); addBranchForm.resetFields(); }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
              >
                Create Branch
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Dashboard;