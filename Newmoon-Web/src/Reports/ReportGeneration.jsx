import { useNavigate } from "react-router-dom";
import { Card, Row, Col, Typography, Tag } from "antd";
import {
  BarChartOutlined,
  InboxOutlined,
  CalendarOutlined,
  ShopOutlined,
  SwapOutlined,
  FileTextOutlined,
  RiseOutlined,
  TruckOutlined,
  RightOutlined,
  LineChartOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

const reportCards = [
  {
    title: "Sales Report",
    description: "Revenue, transactions, trends, and sales performance analysis",
    icon: <BarChartOutlined style={{ fontSize: 32, color: "#1890ff" }} />,
    color: "#1890ff",
    bg: "from-blue-500 to-blue-600",
    path: "/reports/sales",
    tag: "Financial",
  },
  {
    title: "Inventory Report",
    description: "Stock levels, product movements, and low stock alerts",
    icon: <InboxOutlined style={{ fontSize: 32, color: "#52c41a" }} />,
    color: "#52c41a",
    bg: "from-green-500 to-green-600",
    path: "/reports/inventory",
    tag: "Stock",
  },
  {
    title: "Attendance Report",
    description: "Staff attendance patterns, lateness, and hours worked",
    icon: <CalendarOutlined style={{ fontSize: 32, color: "#722ed1" }} />,
    color: "#722ed1",
    bg: "from-purple-500 to-purple-600",
    path: "/reports/attendance",
    tag: "HR",
  },
  {
    title: "Branch Report",
    description: "Branch performance comparison, sales, and staff distribution",
    icon: <ShopOutlined style={{ fontSize: 32, color: "#13c2c2" }} />,
    color: "#13c2c2",
    bg: "from-cyan-500 to-cyan-600",
    path: "/reports/branch",
    tag: "Operations",
  },
  {
    title: "Pull-Out Report",
    description: "Item transfers, pull-out requests, and stock adjustments",
    icon: <SwapOutlined style={{ fontSize: 32, color: "#eb2f96" }} />,
    color: "#eb2f96",
    bg: "from-pink-500 to-pink-600",
    path: "/reports/pullout",
    tag: "Stock",
  },
  {
    title: "Reservations Report",
    description: "Reservation status, pickup trends, and customer bookings",
    icon: <FileTextOutlined style={{ fontSize: 32, color: "#f97316" }} />,
    color: "#f97316",
    bg: "from-orange-500 to-orange-600",
    path: "/reservations",
    tag: "Operations",
  },
  {
    title: "Deliveries Report",
    description: "Delivery status, rider assignments, and order fulfillment",
    icon: <TruckOutlined style={{ fontSize: 32, color: "#06b6d4" }} />,
    color: "#06b6d4",
    bg: "from-teal-500 to-teal-600",
    path: "/delivery",
    tag: "Operations",
  },
  {
    title: "Staff Performance Report",
    description: "Productivity scores, attendance rate, sales, and quota achievement",
    icon: <RiseOutlined style={{ fontSize: 32, color: "#8b5cf6" }} />,
    color: "#8b5cf6",
    bg: "from-violet-500 to-violet-600",
    path: "/staff-performance",
    tag: "HR",
  },
];

const tagColors = {
  Financial: "black",
  Stock: "green",
  HR: "purple",
  Operations: "cyan",
};

function ReportGeneration() {
  const navigate = useNavigate();

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
                <LineChartOutlined className="mr-2" />
                Report Generation
              </h1>
              <p className="text-white/80 text-sm">Central hub for all management reports — sales, inventory, and more</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Financial</p>
              <p className="text-white font-bold text-xl">{reportCards.filter(c => c.tag === "Financial").length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Stock</p>
              <p className="text-white font-bold text-xl">{reportCards.filter(c => c.tag === "Stock").length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">HR</p>
              <p className="text-white font-bold text-xl">{reportCards.filter(c => c.tag === "HR").length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Operations</p>
              <p className="text-white font-bold text-xl">{reportCards.filter(c => c.tag === "Operations").length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Cards Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <BarChartOutlined className="mr-2 text-[#E53935]" />
              Available Reports
            </h2>
            <p className="text-sm text-gray-500 mt-1">Click a report card to view details</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {reportCards.length} reports
          </Tag>
        </div>
      </div>

      <Row gutter={[20, 20]}>
        {reportCards.map((card) => (
          <Col xs={24} sm={12} lg={8} key={card.path}>
            <Card
              hoverable
              className="!rounded-xl !border !border-[#E3F2FD] !shadow-sm hover:!shadow-[0_8px_25px_rgba(229,57,53,0.15)] transition-all duration-300 overflow-hidden group"
              styles={{ body: { padding: 0 } }}
              onClick={() => navigate(card.path)}
            >
              <div className="relative">
                <div className={`bg-gradient-to-r ${card.bg} p-5`}>
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                      {card.icon}
                    </div>
                    <Tag color="white" className="!text-xs !font-semibold !border-none !opacity-90">
                      {card.tag}
                    </Tag>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <Title level={5} className="!mb-0 !text-[#1A237E]">
                      {card.title}
                    </Title>
                    <RightOutlined className="text-gray-300 group-hover:text-[#E53935] transition-colors text-sm" />
                  </div>
                  <Text type="secondary" className="!text-sm">
                    {card.description}
                  </Text>
                </div>
                <div
                  className="absolute bottom-0 left-0 right-0 h-1 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
                  style={{ backgroundColor: "#E53935" }}
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default ReportGeneration;
