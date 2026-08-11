import { useState, useEffect, useRef } from "react";
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, message, Tag, Tooltip, Upload
} from "antd";
import {
  PlusOutlined,
  ShoppingOutlined,
  DeleteOutlined,
  BoxPlotOutlined,
  BranchesOutlined,
  SearchOutlined,
  ReloadOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { api, API_BASE_URL } from "../config/api";
import { getCache, setCache, invalidateCache } from "../utils/cache";

function formatRestockedAtUtcClock(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hh, mm, ss = "00"] = match;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[parseInt(month, 10) - 1] || month;
  const hour24 = parseInt(hh, 10);
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${monthName} ${parseInt(day, 10)}, ${year}, ${String(hour12).padStart(2, "0")}:${mm}:${ss} ${ampm}`;
}

function ProductList() {
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRestockModalVisible, setIsRestockModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [stockQuantity, setStockQuantity] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusAction, setStatusAction] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [hasEditImage, setHasEditImage] = useState(false);
  const [editImageFileName, setEditImageFileName] = useState('');
  const editImageFileRef = useRef(null);
  const [hasImage, setHasImage] = useState(false);
  const [imageFileName, setImageFileName] = useState('');
  const imageFileRef = useRef(null);
  const [restockForm] = Form.useForm();
  const [createForm] = Form.useForm();
  const [statusForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cachedProducts = forceRefresh ? null : getCache('products');
      const cachedBranches = forceRefresh ? null : getCache('branches');
      if (cachedProducts && cachedBranches && !forceRefresh) {
        setProducts(cachedProducts);
        setBranches(cachedBranches);
        setLoading(false);
        return;
      }
      const [productsRes, branchesRes] = await Promise.all([
        api.get("/products", { params: { include_inactive: true } }),
        api.get("/branches"),
      ]);
      const productsData = productsRes.data.data || [];
      const branchesData = branchesRes.data.data || [];
      setProducts(productsData);
      setBranches(branchesData);
      setCache('products', productsData);
      setCache('branches', branchesData);
    } catch (error) {
      console.error("Failed to load products:", error);
      message.error("Failed to load products from backend.");
      setProducts([]);
      setBranches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isCreateModalVisible) {
      setHasImage(false);
      setImageFileName('');
      imageFileRef.current = null;
    }
  }, [isCreateModalVisible]);

  const handleCreateProduct = async () => {
    try {
      const values = await createForm.validateFields();
      const file = imageFileRef.current;
      let payload;

      if (file && file instanceof File) {
        const formData = new FormData();
        formData.append('name', values.name);
        formData.append('price', values.price);
        formData.append('image', file);
        values.branches?.forEach((b) => formData.append('branches[]', b));
        payload = formData;
      } else {
        payload = {
          name: values.name,
          price: values.price,
          branches: values.branches,
        };
      }

      const { data } = await api.post("/products", payload);
      setProducts([data, ...products]);
      invalidateCache('products');
      message.success(`${values.name} has been created successfully.`);
      setIsCreateModalVisible(false);
      createForm.resetFields();
      setHasImage(false);
      setImageFileName('');
      imageFileRef.current = null;
    } catch (error) {
      if (error.errorFields) return;
      const errData = error?.response?.data;
      const errMsg = errData?.error || errData?.message || "Failed to create product";
      if (errData?.errors) {
        const details = Object.entries(errData.errors).map(([k, v]) => `${k}: ${v.join?.('; ') || v}`).join(' | ');
        message.error(`${errMsg} (${details})`);
      } else {
        message.error(errMsg);
      }
    }
  };

  const handleRestock = async () => {
    try {
      const values = await restockForm.validateFields();
      const quantity = parseInt(values.quantity, 10);
      await api.post(`/products/${selectedProduct.id}/restock`, {
        branch_id: values.branch_id,
        quantity,
      });
      message.success(`Added ${quantity} units to ${selectedProduct.name}`);
      setIsRestockModalVisible(false);
      restockForm.resetFields();
      setSelectedProduct(null);
      invalidateCache('products');
      await loadData(true);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error?.response?.data?.message || "Failed to restock product");
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      setProducts(products.filter(p => p.id !== deleteTarget.id));
      invalidateCache('products');
      message.success(`${deleteTarget.name} has been deleted`);
      setIsDeleteModalVisible(false);
      setDeleteTarget(null);
    } catch (error) {
      message.error(error?.response?.data?.message || "Failed to delete product");
    }
  };

  const isProductActive = (value) => value === true || value === 1 || value === "1";

  const toggleProductActive = async () => {
    if (!statusTarget) return;
    const nextActive = !isProductActive(statusTarget?.is_active);
    try {
      await api.put(`/products/${statusTarget.id}`, { is_active: nextActive });
      invalidateCache("products");
      await loadData(true);
      message.success(nextActive ? "Product enabled." : "Product disabled.");
      setIsStatusModalVisible(false);
      setStatusTarget(null);
      setStatusAction(null);
    } catch (error) {
      message.error(error?.response?.data?.message || "Failed to update product status");
    }
  };

  const handleUpdateProduct = async () => {
    try {
      const values = await editForm.validateFields();
      const file = editImageFileRef.current;
      const productId = editTarget?.id;

      if (file && file instanceof File) {
        const formData = new FormData();
        formData.append('_method', 'PUT');
        formData.append('name', values.name);
        formData.append('price', values.price);
        formData.append('image', file);
        await api.post(`/products/${productId}`, formData);
      } else {
        await api.put(`/products/${productId}`, {
          name: values.name,
          price: values.price,
        });
      }

      invalidateCache('products');
      await loadData(true);
      message.success(`${values.name} has been updated.`);
      setIsEditModalVisible(false);
      setEditTarget(null);
      editImageFileRef.current = null;
      setHasEditImage(false);
      setEditImageFileName('');
    } catch (error) {
      if (error.errorFields) return;
      const errData = error?.response?.data;
      const errMsg = errData?.error || errData?.message || "Failed to update product";
      if (errData?.errors) {
        const details = Object.entries(errData.errors).map(([k, v]) => `${k}: ${v.join?.('; ') || v}`).join(' | ');
        message.error(`${errMsg} (${details})`);
      } else {
        message.error(errMsg);
      }
    }
  };

  const getTotalStock = (product) => {
    if (!product.product_stocks) return 0;
    return product.product_stocks.reduce((sum, stock) => sum + (stock.received ? stock.quantity : 0), 0);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBranchProductStocks = () => {
    const branchMap = new Map();
    branches.forEach(branch => {
      branchMap.set(branch.id, { branch, stocks: [] });
    });
    filteredProducts.forEach(product => {
      const perBranch = new Map();
      (product.product_stocks || []).forEach(stock => {
        if (!branchMap.has(stock.branch_id)) return;
        const key = `${stock.branch_id}:${product.id}`;
        const current = perBranch.get(key) || {
          id: key, branch_id: stock.branch_id, product, receivedQty: 0, minimum_stock: 0,
          pendingQty: 0, notReceivedQty: 0, lastRestockedAt: null, deliveries: [],
        };
        current.receivedQty = Number(stock.quantity || 0);
        current.minimum_stock = stock.minimum_stock || 0;
        if (stock.restocked_at) current.lastRestockedAt = stock.restocked_at;
        perBranch.set(key, current);
      });
      (product.ongoing_stocks || []).forEach(delivery => {
        if (!branchMap.has(delivery.branch_id)) return;
        const key = `${delivery.branch_id}:${product.id}`;
        const current = perBranch.get(key) || {
          id: key, branch_id: delivery.branch_id, product, receivedQty: 0, pendingQty: 0,
          notReceivedQty: 0, lastRestockedAt: null, deliveries: [],
        };
        const qty = Number(delivery.quantity || 0);
        if (delivery.marked_as_not_received && !delivery.received_at) {
          current.notReceivedQty += qty;
        } else if (!delivery.received_at) {
          current.pendingQty += qty;
        }
        current.deliveries.push({
          id: delivery.id, quantity: qty, restocked_at: delivery.restocked_at,
          received_at: delivery.received_at, marked_as_not_received: !!delivery.marked_as_not_received,
          not_received_at: delivery.not_received_at,
        });
        if (delivery.restocked_at) {
          const prevMs = current.lastRestockedAt ? new Date(current.lastRestockedAt).getTime() : NaN;
          const nextMs = new Date(delivery.restocked_at).getTime();
          if (!Number.isNaN(nextMs) && (Number.isNaN(prevMs) || nextMs > prevMs)) {
            current.lastRestockedAt = delivery.restocked_at;
          }
        }
        perBranch.set(key, current);
      });
      perBranch.forEach((row) => {
        if (branchMap.has(row.branch_id)) {
          branchMap.get(row.branch_id).stocks.push(row);
        }
      });
    });
    return Array.from(branchMap.values());
  };

  const branchProductStocks = getBranchProductStocks();

  const tableData = [];
  branchProductStocks.forEach(({ branch, stocks }) => {
    stocks.forEach((stock) => {
      tableData.push({ ...stock, branchName: branch.name, branchId: branch.id });
    });
  });

  const filteredTableData = branchFilter === "all"
    ? tableData
    : tableData.filter((d) => String(d.branchId) === branchFilter);

  const totalProducts = products.length;
  const parseProductPrice = (p) => { const n = Number(p?.price); return Number.isFinite(n) ? n : NaN; };
  const totalStockValue = products.reduce((sum, product) => {
    const price = parseProductPrice(product);
    const qty = getTotalStock(product);
    return sum + (Number.isFinite(price) ? qty * price : 0);
  }, 0);
  const validPrices = products.map(parseProductPrice).filter((n) => Number.isFinite(n));
  const avgPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;

  const formatCurrency = (amount) => `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const columns = [
    {
      title: "Branch",
      key: "branch",
      render: (_, r) => (
        <span><BranchesOutlined className="mr-1 text-blue-500" />{r.branchName}</span>
      ),
    },
    {
      title: "Product",
      key: "product",
      render: (_, r) => (
        <div className="flex items-center gap-2">
          {r.product.image ? (
            <img
              src={`${API_BASE_URL.replace('/api', '')}/storage/${r.product.image}`}
              alt={r.product.name}
              className="w-10 h-10 object-cover rounded"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">
              <ShoppingOutlined />
            </div>
          )}
          <span className="font-semibold">{r.product.name}</span>
        </div>
      ),
    },
    {
      title: "Price",
      key: "price",
      render: (_, r) => <span className="text-green-600 font-semibold">{formatCurrency(r.product.price)}</span>,
    },
    {
      title: "Stock Level",
      key: "stock",
      render: (_, r) => {
        const receivedQty = Number(r.receivedQty || 0);
        const minStock = Number(r.minimum_stock || 0);
        const isLowStock = minStock > 0 && receivedQty < minStock;
        const stockPercentage = Math.min((receivedQty / 100) * 100, 100);
        return (
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-bold ${isLowStock ? 'text-red-500' : ''}`}>{receivedQty}</span>
              <span className="text-xs text-gray-500">units</span>
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-1.5 mt-1">
              <div className={`h-1.5 rounded-full ${isLowStock ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${stockPercentage}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      title: "Ongoing",
      key: "ongoing",
      render: (_, r) => {
        const pendingQty = Number(r.pendingQty || 0);
        const notReceivedQty = Number(r.notReceivedQty || 0);
        if (pendingQty > 0) return <Tag color="orange">{pendingQty} pending</Tag>;
        if (notReceivedQty > 0) return <Tag color="red">{notReceivedQty} not received</Tag>;
        return <span className="text-gray-400">—</span>;
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) => {
        const minStock = Number(r.minimum_stock || 0);
        const receivedQty = Number(r.receivedQty || 0);
        const isLowStock = minStock > 0 && receivedQty < minStock;
        return isLowStock
          ? <Tag color="orange" icon={<WarningOutlined />}>Low Stock</Tag>
          : <Tag color="green">In Stock</Tag>;
      },
    },
    {
      title: "Last Restocked",
      key: "lastRestocked",
      render: (_, r) => {
        const formatted = formatRestockedAtUtcClock(r.lastRestockedAt);
        return formatted ? <span className="text-xs">{formatted}</span> : <span className="text-gray-400 text-xs">Never</span>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Tooltip title="Restock">
            <Button size="small" icon={<PlusOutlined />} onClick={() => {
              setSelectedProduct(r.product);
              restockForm.setFieldsValue({ branch_id: r.branchId });
              setIsRestockModalVisible(true);
            }}>
              Restock
            </Button>
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<ShoppingOutlined />} onClick={() => {
              setEditTarget(r.product);
              editForm.setFieldsValue({ name: r.product.name, price: r.product.price });
              editImageFileRef.current = null;
              setHasEditImage(false);
              setEditImageFileName('');
              setIsEditModalVisible(true);
            }}>
              Edit
            </Button>
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => {
              setDeleteTarget(r.product);
              setIsDeleteModalVisible(true);
            }} />
          </Tooltip>
          <Tooltip title={isProductActive(r.product?.is_active) ? "Disable" : "Enable"}>
            <Button
              size="small"
              type={isProductActive(r.product?.is_active) ? "default" : "primary"}
              onClick={() => {
                setStatusTarget(r.product);
                setStatusAction(!isProductActive(r.product?.is_active));
                setIsStatusModalVisible(true);
              }}
            >
              {isProductActive(r.product?.is_active) ? "Disable" : "Enable"}
            </Button>
          </Tooltip>
        </Space>
      ),
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
                <ShoppingOutlined className="mr-2" />
                Products Management
              </h1>
              <p className="text-white/80 text-sm">Manage your product inventory and stock levels across all branches</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Products</p>
              <p className="text-white font-bold text-xl">{totalProducts}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Stock Value</p>
              <p className="text-white font-bold text-xl">{formatCurrency(totalStockValue)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Average Price</p>
              <p className="text-white font-bold text-xl">{formatCurrency(avgPrice)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - FoodMeal Style */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <Space wrap>
          <Input
            placeholder="Search product..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 250 }}
            allowClear
            className="rounded-xl"
          />
          <Select
            value={branchFilter}
            onChange={setBranchFilter}
            style={{ width: 180 }}
            placeholder="Filter by branch"
            className="rounded-xl"
          >
            <Select.Option value="all">All Branches</Select.Option>
            {branches.map((b) => (
              <Select.Option key={b.id} value={String(b.id)}>{b.name}</Select.Option>
            ))}
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadData(true)}
            loading={loading}
            className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalVisible(true)}
            className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
          >
            Create New Product
          </Button>
        </Space>
      </Card>

      {/* Product Inventory Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <ShoppingOutlined className="mr-2 text-[#E53935]" />
              Product Inventory
            </h2>
            <p className="text-sm text-gray-500 mt-1">Track stock levels across all branches</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {filteredTableData.length} stock entries
          </Tag>
        </div>
      </div>

      <Card
        className="rounded-xl border border-[#E3F2FD] shadow-sm"
      >
        <Table
          columns={columns}
          dataSource={filteredTableData}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} entries` }}
          locale={{ emptyText: <div className="py-8 text-center"><BoxPlotOutlined className="text-4xl text-gray-300 mb-2" /><p className="text-gray-500">No products found</p><p className="text-gray-400 text-sm">Try adjusting your search or filter</p></div> }}
        />
      </Card>

      {/* Create Product Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <PlusOutlined className="mr-2 text-[#E53935]" />
            <span className="text-[#1A237E] font-bold">Create New Product</span>
          </span>
        }
        open={isCreateModalVisible}
        onCancel={() => { setIsCreateModalVisible(false); createForm.resetFields(); setHasImage(false); setImageFileName(''); imageFileRef.current = null; }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateProduct}>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Product Name</span>}
            name="name"
            rules={[{ required: true, message: "Please enter product name" }]}
          >
            <Input
              placeholder="Enter product name"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Price (₱)</span>}
            name="price"
            rules={[{ required: true, message: "Please enter price" }]}
          >
            <Input
              type="number"
              min={0}
              step={10}
              placeholder="Enter price"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <div className="mb-4">
            <div className="font-medium text-[#1A237E] mb-1">Product Image (optional)</div>
            <Upload
              listType="picture-card"
              showUploadList={{ showPreviewIcon: false }}
              beforeUpload={(file) => { imageFileRef.current = file; setHasImage(true); setImageFileName(file.name); return false; }}
              onRemove={() => { imageFileRef.current = null; setHasImage(false); setImageFileName(''); return true; }}
              maxCount={1}
              fileList={hasImage ? [{ uid: '-1', name: imageFileName, status: 'done' }] : []}
            >
              {!hasImage && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </div>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Select Branches</span>}
            name="branches"
            rules={[{ required: true, message: "Please select at least one branch", type: "array", min: 1 }]}
          >
            <Select mode="multiple" placeholder="Select branches" className="rounded-xl">
              {branches.map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#E3F2FD]">
            <p className="text-xs text-[#1A237E] mb-0">
              <InfoCircleOutlined className="mr-1" />
              Product will be created with 0 stock for selected branches. You can add stock later using the "Restock" button.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setIsCreateModalVisible(false); createForm.resetFields(); setHasImage(false); setImageFileName(''); imageFileRef.current = null; }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
              >
                Create Product
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Product Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <ShoppingOutlined className="mr-2 text-[#1565C0]" />
            <span className="text-[#1A237E] font-bold">Edit Product</span>
          </span>
        }
        open={isEditModalVisible}
        onCancel={() => { setIsEditModalVisible(false); setEditTarget(null); editImageFileRef.current = null; setHasEditImage(false); setEditImageFileName(''); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateProduct}>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Product Name</span>}
            name="name"
            rules={[{ required: true, message: "Please enter product name" }]}
          >
            <Input
              placeholder="Enter product name"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Price (₱)</span>}
            name="price"
            rules={[{ required: true, message: "Please enter price" }]}
          >
            <Input
              type="number"
              min={0}
              step={10}
              placeholder="Enter price"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          {editTarget?.image && (
            <div className="mb-4">
              <div className="font-medium text-[#1A237E] mb-1">Current Image</div>
              <img
                src={`${API_BASE_URL.replace('/api', '')}/storage/${editTarget.image}`}
                alt={editTarget.name}
                className="w-20 h-20 object-cover rounded-xl"
              />
            </div>
          )}
          <div className="mb-4">
            <div className="font-medium text-[#1A237E] mb-1">New Image (optional)</div>
            <Upload
              listType="picture-card"
              showUploadList={{ showPreviewIcon: false }}
              beforeUpload={(file) => { editImageFileRef.current = file; setHasEditImage(true); setEditImageFileName(file.name); return false; }}
              onRemove={() => { editImageFileRef.current = null; setHasEditImage(false); setEditImageFileName(''); return true; }}
              maxCount={1}
              fileList={hasEditImage ? [{ uid: '-1', name: editImageFileName, status: 'done' }] : []}
            >
              {!hasEditImage && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setIsEditModalVisible(false); setEditTarget(null); editImageFileRef.current = null; setHasEditImage(false); setEditImageFileName(''); }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
              >
                Update Product
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Restock Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <PlusOutlined className="mr-2 text-[#E53935]" />
            <span className="text-[#1A237E] font-bold">Restock - {selectedProduct?.name || ""}</span>
          </span>
        }
        open={isRestockModalVisible}
        onCancel={() => { setIsRestockModalVisible(false); restockForm.resetFields(); setSelectedProduct(null); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={restockForm} layout="vertical" onFinish={handleRestock}>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Branch</span>}
            name="branch_id"
            rules={[{ required: true, message: "Please select a branch" }]}
          >
            <Select
              placeholder="Select Branch"
              className="rounded-xl"
            >
              {branches.map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Stock Quantity (units)</span>}
            name="quantity"
            rules={[{ required: true, message: "Please enter quantity" }]}
          >
            <Input
              type="number"
              min={1}
              placeholder="Enter stock quantity"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setIsRestockModalVisible(false); restockForm.resetFields(); setSelectedProduct(null); }}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
              >
                Add Stock
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <DeleteOutlined className="mr-2 text-[#E53935]" />
            <span className="text-[#1A237E] font-bold">Delete Product</span>
          </span>
        }
        open={isDeleteModalVisible}
        onCancel={() => { setIsDeleteModalVisible(false); setDeleteTarget(null); }}
        onOk={handleDeleteProduct}
        okText="Delete"
        okButtonProps={{ danger: true, className: "rounded-xl" }}
        cancelText="Cancel"
        confirmLoading={false}
        className="rounded-2xl"
      >
        <p>Are you sure you want to delete <strong className="text-[#E53935]">"{deleteTarget?.name}"</strong>?</p>
        <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
      </Modal>

      {/* Status Toggle Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <WarningOutlined className="mr-2 text-[#E53935]" />
            <span className="text-[#1A237E] font-bold">{statusAction ? "Enable Product" : "Disable Product"}</span>
          </span>
        }
        open={isStatusModalVisible}
        onCancel={() => { setIsStatusModalVisible(false); setStatusTarget(null); setStatusAction(null); }}
        onOk={toggleProductActive}
        okText={statusAction ? "Enable" : "Disable"}
        okButtonProps={{ danger: !statusAction, className: "rounded-xl" }}
        cancelText="Cancel"
        className="rounded-2xl"
      >
        <p>
          {statusAction
            ? `Enable "${statusTarget?.name}" so it appears in active product lists again?`
            : `Disable "${statusTarget?.name}"? This will hide it from active lists but keep sales records.`}
        </p>
      </Modal>
    </div>
  );
}

export default ProductList;
