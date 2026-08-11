import { useState } from "react";
import {
  Card, Table, Button, Modal, Input, InputNumber, Select, message,
  Tag, Row, Col, Space, Checkbox, Divider, Tooltip, DatePicker,
} from "antd";
import {
  ShoppingCartOutlined, TransactionOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, EyeOutlined, InfoCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../config/api";

const { RangePicker } = DatePicker;

const fmtCurrency = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function SalesRecord() {
  const queryClient = useQueryClient();

  // Filters for sales history
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateRange, setDateRange] = useState(null);

  // New sale form state
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleBranch, setSaleBranch] = useState(null);
  const [saleUser, setSaleUser] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [seniorDiscount, setSeniorDiscount] = useState(false);
  const [cashCollected, setCashCollected] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saleItems, setSaleItems] = useState([{ product_id: null, quantity: 1, product_name: "", product_price: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [detailSale, setDetailSale] = useState(null);

  // Data fetching
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches"),
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.get("/staff"),
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products", { params: { per_page: 200 } }),
  });

  const params = {};
  if (branchFilter !== "all") params.branch_id = branchFilter;
  if (dateRange && dateRange[0] && dateRange[1]) {
    params.start_date = dateRange[0].format("YYYY-MM-DD");
    params.end_date = dateRange[1].format("YYYY-MM-DD");
  }

  const { data: salesData, isLoading, refetch } = useQuery({
    queryKey: ["sales", params],
    queryFn: () => api.get("/sales", { params }),
  });

  const branches = branchesData?.data?.data || [];
  const staff = staffData?.data?.data || [];
  const products = productsData?.data?.data || [];
  const sales = salesData?.data?.data || [];

  // Compute today's stats from loaded sales
  const phNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const today = phNow.toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => String(s.sale_date).startsWith(today));
  const todayCount = todaySales.length;
  const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const todayItems = todaySales.reduce((sum, s) => {
    if (s.items) return sum + s.items.reduce((iSum, item) => iSum + Number(item.quantity || 0), 0);
    return sum;
  }, 0);

  // Add item row
  const addItem = () => {
    setSaleItems([...saleItems, { product_id: null, quantity: 1, product_name: "", product_price: 0 }]);
  };

  // Remove item row
  const removeItem = (idx) => {
    if (saleItems.length <= 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== idx));
  };

  // Update item
  const updateItem = (idx, field, value) => {
    const updated = [...saleItems];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      updated[idx] = {
        ...updated[idx],
        product_id: value,
        product_name: product?.name || "",
        product_price: Number(product?.price || 0),
        quantity: 1,
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setSaleItems(updated);
  };

  // Calculate totals
  const subtotal = saleItems.reduce((sum, item) => {
    return sum + (item.product_price * (item.quantity || 0));
  }, 0);

  const discountAmount = seniorDiscount ? subtotal * 0.2 : 0;
  const total = Math.max(subtotal - discountAmount, 0);
  const change = cashCollected - total;

  // Submit sale
  const submitSale = async () => {
    if (!saleBranch) { message.error("Please select a branch"); return; }
    if (!saleUser) { message.error("Please select a staff member"); return; }
    if (!saleItems.length || saleItems.every((i) => !i.product_id)) { message.error("Please add at least one item"); return; }
    if (saleItems.some((i) => !i.product_id)) { message.error("Please select a product for all item rows"); return; }
    if (cashCollected < total) { message.error("Cash collected must be at least the total amount"); return; }

    setSubmitting(true);
    try {
      const payload = {
        branch_id: saleBranch,
        user_id: saleUser,
        customer_name: customerName || null,
        senior_discount: seniorDiscount,
        items: saleItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        cash_collected: cashCollected,
        payment_method: paymentMethod,
      };

      await api.post("/sales", payload);
      message.success("Sale recorded successfully!");
      setShowSaleModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || "Failed to record sale";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSaleBranch(null);
    setSaleUser(null);
    setCustomerName("");
    setSeniorDiscount(false);
    setCashCollected(0);
    setPaymentMethod("cash");
    setSaleItems([{ product_id: null, quantity: 1, product_name: "", product_price: 0 }]);
  };

  const columns = [
    {
      title: "Invoice",
      dataIndex: "invoice_number",
      key: "invoice_number",
      width: 160,
      render: (v) => <span className="font-mono text-sm">{v}</span>,
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      width: 120,
      render: (v) => v ? new Date(v + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "-",
    },
    {
      title: "Branch",
      key: "branch",
      width: 140,
      render: (_, r) => r.branch?.name || "-",
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
      width: 140,
      render: (v) => v || <span className="text-gray-400">Walk-in</span>,
    },
    {
      title: "Items",
      key: "items_count",
      width: 80,
      render: (_, r) => (r.items?.length || 0),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 120,
      render: (v) => <span className="font-semibold text-green-600">{fmtCurrency(v)}</span>,
    },
    {
      title: "Payment",
      dataIndex: "payment_method",
      key: "payment_method",
      width: 100,
      render: (v) => <Tag>{v || "cash"}</Tag>,
    },
    {
      title: "Cashier",
      key: "user",
      width: 140,
      render: (_, r) => r.user?.firstname ? `${r.user.firstname} ${r.user.lastname || ""}` : r.user?.username || "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, r) => (
        <Tooltip title="View Details">
          <Button type="text" icon={<EyeOutlined />} onClick={() => setDetailSale(r)} />
        </Tooltip>
      ),
    },
  ];

  const productOptions = products
    .filter((p) => p.is_active !== false)
    .map((p) => {
      const stock = (p.stocks || []).find((s) => Number(s.branch_id) === Number(saleBranch));
      const qty = Number(stock?.quantity || 0);
      const hasBranch = !!saleBranch;
      return {
        value: p.id,
        disabled: hasBranch && qty <= 0,
        label: hasBranch
          ? `${p.name}${p.sku ? ` (${p.sku})` : ""} — ${fmtCurrency(p.price)}  [Stock: ${qty}]`
          : `${p.name}${p.sku ? ` (${p.sku})` : ""} — ${fmtCurrency(p.price)}`,
        stockQty: qty,
      };
    });

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
                <ShoppingCartOutlined className="mr-2" />
                Sales Record
              </h1>
              <p className="text-white/80 text-sm">Record new sales and view sales history</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Today's Transactions</p>
              <p className="text-white font-bold text-xl">{todayCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Today's Revenue</p>
              <p className="text-white font-bold text-xl">{fmtCurrency(todayRevenue)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Items Sold Today</p>
              <p className="text-white font-bold text-xl">{todayItems}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Transactions</p>
              <p className="text-white font-bold text-xl">{sales.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - FoodMeal Style */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="primary"
            size="large"
            icon={<ShoppingCartOutlined />}
            onClick={() => setShowSaleModal(true)}
            className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
          >
            New Sale
          </Button>
          <Space wrap>
            <span className="text-[#1A237E] font-medium text-sm">Branch:</span>
            <Select
              value={branchFilter}
              onChange={setBranchFilter}
              style={{ width: 160 }}
              className="rounded-xl"
            >
              <Select.Option value="all">All Branches</Select.Option>
              {branches.map((b) => (
                <Select.Option key={b.id} value={String(b.id)}>{b.name}</Select.Option>
              ))}
            </Select>
            <RangePicker value={dateRange} onChange={setDateRange} allowClear className="rounded-xl" />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
              className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]"
            >
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      {/* Sales History Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <TransactionOutlined className="mr-2 text-[#E53935]" />
              Sales History
            </h2>
            <p className="text-sm text-gray-500 mt-1">Browse and filter all recorded transactions</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {sales.length} sale{sales.length !== 1 ? 's' : ''}
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#E3F2FD] shadow-sm">
        <Table
          columns={columns}
          dataSource={sales}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} sales` }}
          locale={{
            emptyText: (
              <div className="py-8 text-center">
                <TransactionOutlined className="text-4xl text-gray-300 mb-2" />
                <p className="text-gray-500">No sales recorded yet</p>
                <p className="text-gray-400 text-sm">Click "New Sale" to record your first transaction</p>
              </div>
            ),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* New Sale Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <ShoppingCartOutlined className="mr-2 text-[#E53935]" />
            <span className="text-[#1A237E] font-bold">New Sale</span>
          </span>
        }
        open={showSaleModal}
        onCancel={() => { setShowSaleModal(false); resetForm(); }}
        footer={null}
        width={700}
        destroyOnHidden
        className="rounded-2xl"
      >
        <div className="space-y-4">
          {/* Branch & Staff */}
          <Row gutter={16}>
            <Col span={12}>
              <div className="font-medium text-[#1A237E] mb-1">Branch *</div>
              <Select
                value={saleBranch}
                onChange={setSaleBranch}
                style={{ width: "100%" }}
                placeholder="Select branch"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                className="rounded-xl"
              />
            </Col>
            <Col span={12}>
              <div className="font-medium text-[#1A237E] mb-1">Cashier / Staff *</div>
              <Select
                value={saleUser}
                onChange={setSaleUser}
                style={{ width: "100%" }}
                placeholder="Select staff"
                showSearch
                filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
                options={staff.map((s) => ({
                    value: s.id,
                    label: `${s.firstname || ""} ${s.lastname || ""}${s.username ? ` (${s.username})` : ""}`,
                  }))}
                className="rounded-xl"
              />
            </Col>
          </Row>

          {/* Customer Name */}
          <div>
            <div className="font-medium text-[#1A237E] mb-1">Customer Name (optional)</div>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in customer"
              className="rounded-xl"
            />
          </div>

          <Divider />

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-[#1A237E]">Items</span>
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addItem} className="rounded-xl">
                Add Item
              </Button>
            </div>

            {saleItems.map((item, idx) => {
              const opt = productOptions.find((o) => o.value === item.product_id);
              const maxQty = opt?.stockQty || 0;
              return (
              <Row key={idx} gutter={8} className="mb-2 items-center">
                <Col span={10}>
                  <Select
                    value={item.product_id}
                    onChange={(v) => updateItem(idx, "product_id", v)}
                    style={{ width: "100%" }}
                    placeholder="Search product..."
                    showSearch
                    filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
                    options={productOptions}
                  />
                </Col>
                <Col span={4}>
                  <InputNumber
                    value={item.quantity}
                    onChange={(v) => updateItem(idx, "quantity", v || 0)}
                    min={0.5}
                    max={maxQty || undefined}
                    step={0.5}
                    style={{ width: "100%" }}
                    placeholder="Qty"
                  />
                </Col>
                <Col span={3}>
                  <div className="text-gray-600 text-sm pt-1">{fmtCurrency(item.product_price)}</div>
                </Col>
                <Col span={3}>
                  <div className="font-semibold text-[#3f8600] pt-1">{fmtCurrency(item.product_price * (item.quantity || 0))}</div>
                </Col>
                <Col span={2}>
                  {maxQty > 0 ? (
                    <span className="text-xs text-[#1565C0] whitespace-nowrap">{maxQty} avail</span>
                  ) : item.product_id ? (
                    <span className="text-xs text-[#E53935]">out</span>
                  ) : null}
                </Col>
                <Col span={2}>
                  {saleItems.length > 1 && (
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
                  )}
                </Col>
              </Row>
            )})}
          </div>

          <Divider />

          {/* Senior Discount */}
          <Checkbox checked={seniorDiscount} onChange={(e) => setSeniorDiscount(e.target.checked)}>
            Senior Citizen Discount (20%)
          </Checkbox>

          {/* Totals */}
          <div className="bg-[#E3F2FD]/30 p-4 rounded-xl space-y-1">
            <Row justify="space-between"><Col>Subtotal:</Col><Col>{fmtCurrency(subtotal)}</Col></Row>
            {seniorDiscount && (
              <Row justify="space-between" className="text-[#E53935]"><Col>Senior Discount (20%):</Col><Col>-{fmtCurrency(discountAmount)}</Col></Row>
            )}
            <Row justify="space-between" className="text-lg font-bold"><Col>Total:</Col><Col className="text-[#3f8600]">{fmtCurrency(total)}</Col></Row>
          </div>

          {/* Cash Collected & Payment */}
          <Row gutter={16}>
            <Col span={12}>
              <div className="font-medium text-[#1A237E] mb-1">Cash Collected *</div>
              <InputNumber
                value={cashCollected}
                onChange={setCashCollected}
                min={0}
                step={0.25}
                prefix="₱"
                style={{ width: "100%" }}
                placeholder="0.00"
                className="rounded-xl"
              />
            </Col>
            <Col span={6}>
              <div className="font-medium text-[#1A237E] mb-1">Payment Method</div>
              <Select value={paymentMethod} onChange={setPaymentMethod} style={{ width: "100%" }} className="rounded-xl">
                <Select.Option value="cash">Cash</Select.Option>
                <Select.Option value="card">Card</Select.Option>
                <Select.Option value="gcash">GCash</Select.Option>
                <Select.Option value="maya">Maya</Select.Option>
              </Select>
            </Col>
            <Col span={6}>
              <div className="font-medium text-[#1A237E] mb-1">Change</div>
              <div className={`text-xl font-bold pt-1 ${change >= 0 ? "text-[#3f8600]" : "text-[#E53935]"}`}>
                {fmtCurrency(change)}
              </div>
            </Col>
          </Row>

          {/* Submit */}
          <Button
            type="primary"
            size="large"
            block
            icon={<ShoppingCartOutlined />}
            onClick={submitSale}
            loading={submitting}
            className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
          >
            Complete Sale — {fmtCurrency(total)}
          </Button>
        </div>
      </Modal>

      {/* Sale Detail Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <EyeOutlined className="mr-2 text-[#1565C0]" />
            <span className="text-[#1A237E] font-bold">Sale Details — {detailSale?.invoice_number || ""}</span>
          </span>
        }
        open={!!detailSale}
        onCancel={() => setDetailSale(null)}
        footer={<Button onClick={() => setDetailSale(null)} className="rounded-xl">Close</Button>}
        width={600}
        className="rounded-2xl"
      >
        {detailSale && (
          <div className="space-y-4">
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-gray-500 text-sm">Branch</div>
                <div className="font-semibold text-[#1A237E]">{detailSale.branch?.name || "-"}</div>
              </Col>
              <Col span={12}>
                <div className="text-gray-500 text-sm">Date</div>
                <div className="font-semibold text-[#1A237E]">{detailSale.sale_date}</div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-gray-500 text-sm">Customer</div>
                <div className="font-semibold text-[#1A237E]">{detailSale.customer_name || "Walk-in"}</div>
              </Col>
              <Col span={12}>
                <div className="text-gray-500 text-sm">Cashier</div>
                <div className="font-semibold text-[#1A237E]">
                  {detailSale.user?.firstname} {detailSale.user?.lastname || ""}
                </div>
              </Col>
            </Row>
            <Divider />
            <div className="text-[#1A237E] font-medium text-sm mb-2">Items</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 text-gray-500">Product</th>
                  <th className="text-right py-1 text-gray-500">Qty</th>
                  <th className="text-right py-1 text-gray-500">Price</th>
                  <th className="text-right py-1 text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {(detailSale.items || []).map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1">{item.product?.name || `Product #${item.product_id}`}</td>
                    <td className="text-right py-1">{item.quantity}</td>
                    <td className="text-right py-1">{fmtCurrency(item.price)}</td>
                    <td className="text-right py-1 font-semibold">{fmtCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Divider />
            <div className="bg-[#E3F2FD]/30 p-4 rounded-xl space-y-1">
              <Row justify="space-between"><Col>Subtotal:</Col><Col>{fmtCurrency(detailSale.subtotal)}</Col></Row>
              {Number(detailSale.discount_amount) > 0 && (
                <Row justify="space-between" className="text-[#E53935]"><Col>Discount:</Col><Col>-{fmtCurrency(detailSale.discount_amount)}</Col></Row>
              )}
              <Row justify="space-between" className="text-lg font-bold"><Col>Total:</Col><Col className="text-[#3f8600]">{fmtCurrency(detailSale.total)}</Col></Row>
              <Row justify="space-between"><Col>Cash Collected:</Col><Col>{fmtCurrency(detailSale.cash_collected)}</Col></Row>
              <Row justify="space-between"><Col>Change:</Col><Col>{fmtCurrency(detailSale.change_given)}</Col></Row>
              <Row justify="space-between"><Col>Payment Method:</Col><Col><Tag>{detailSale.payment_method || "cash"}</Tag></Col></Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SalesRecord;
