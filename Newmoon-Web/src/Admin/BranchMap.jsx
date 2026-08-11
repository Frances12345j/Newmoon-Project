import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, Table, Tag, Button, Modal, Form, Input, Space, message, Tooltip } from "antd";
import {
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  EditOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Icon, divIcon, point } from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { api } from "../config/api";
import { getCache, setCache, invalidateCache } from "../utils/cache";
import "leaflet/dist/leaflet.css";

const style = document.createElement('style');
style.innerHTML = `
  .custom-marker-cluster {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }
  .cluster-icon {
    font-size: 14px;
    font-weight: bold;
  }
`;
document.head.appendChild(style);

const customIcon = new Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
  shadowSize: [38, 38]
});

const createClusterCustomIcon = function (cluster) {
  return new divIcon({
    html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
    className: "custom-marker-cluster",
    iconSize: point(40, 40, true)
  });
};

function MapBounds({ branches }) {
  const map = useMap();
  useEffect(() => {
    if (branches.length > 0) {
      const validBranches = branches.filter(b => b.latitude && b.longitude);
      if (validBranches.length > 0) {
        const bounds = validBranches.map(b => [b.latitude, b.longitude]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [branches, map]);
  return null;
}

function MapInitializer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function MapFlyTo({ branch }) {
  const map = useMap();
  useEffect(() => {
    if (branch && branch.latitude && branch.longitude) {
      map.flyTo([branch.latitude, branch.longitude], 16, { duration: 1 });
    }
  }, [branch, map]);
  return null;
}

function BranchMap() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [editFormInstance] = Form.useForm();
  const [flyTarget, setFlyTarget] = useState(null);
  const tableRef = useRef(null);

  const loadBranches = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cachedBranches = forceRefresh ? null : getCache('branches');
      if (cachedBranches) {
        setBranches(cachedBranches);
        setLoading(false);
        return;
      }
      const response = await api.get("/branches");
      const branchesData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setBranches(branchesData);
      setCache('branches', branchesData);
    } catch (error) {
      console.error("Failed to load branches:", error);
      message.error("Failed to load branches from backend.");
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const filteredBranches = useMemo(() => {
    return branches.filter(branch =>
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.address && branch.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [branches, searchTerm]);

  const branchesWithLocation = useMemo(() => filteredBranches.filter(b => b.latitude && b.longitude), [filteredBranches]);
  const branchesWithoutLocation = useMemo(() => filteredBranches.filter(b => !b.latitude || !b.longitude), [filteredBranches]);

  const handleMarkerClick = useCallback((branch) => {
    setSelectedBranch(branch);
    const rowEl = tableRef.current?.querySelector(`[data-row-key="${branch.id}"]`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
      rowEl.style.transition = "background 0.3s";
      rowEl.style.background = "#E3F2FD";
      setTimeout(() => { rowEl.style.background = ""; }, 2000);
    }
  }, []);

  const handleRowClick = useCallback((record) => {
    setSelectedBranch(record);
    if (record.latitude && record.longitude) {
      setFlyTarget(record);
    }
  }, []);

  const handleOpenGoogleMaps = (branch) => {
    if (branch.latitude && branch.longitude) {
      window.open(`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`, '_blank');
    }
  };

  const handleOpenOpenStreetMap = (branch) => {
    if (branch.latitude && branch.longitude) {
      window.open(`https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=15/${branch.latitude}/${branch.longitude}`, '_blank');
    }
  };

  const handleEditLocation = (branch) => {
    setEditingBranch(branch);
    editFormInstance.setFieldsValue({ address: branch.address || "" });
    setIsEditModalVisible(true);
  };

  const handleSaveLocation = async () => {
    if (!editingBranch) return;
    try {
      const values = await editFormInstance.validateFields();
      if (!values.address || values.address.trim() === "") {
        message.error("Please enter an address.");
        return;
      }

      setIsGeocoding(true);
      const searchQueries = [
        values.address,
        values.address.replace(/,/g, ''),
        values.address.split(',')[0],
        `${values.address}, Philippines`,
        values.address.replace(/\+/g, ' '),
      ];

      let geocodeResult = null;
      for (const query of searchQueries) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
          );
          const data = await response.json();
          if (data && data.length > 0) { geocodeResult = data[0]; break; }
        } catch (e) { continue; }
      }

      if (!geocodeResult) {
        Modal.confirm({
          title: "Geocoding Failed",
          content: "Automatic geocoding failed. Would you like to enter coordinates manually?",
          okText: "Manual Entry",
          cancelText: "Cancel",
          onOk: () => {
            Modal.confirm({
              title: "Enter Coordinates",
              content: (
                <div>
                  <p className="mb-2">Format: latitude, longitude</p>
                  <p className="text-sm text-gray-500">Example: 8.4845, 124.6522</p>
                </div>
              ),
              okText: "Save",
              onOk: async () => {
                setIsGeocoding(false);
              },
            });
          },
        });
        setIsGeocoding(false);
        return;
      }

      const lat = parseFloat(geocodeResult.lat);
      const lng = parseFloat(geocodeResult.lon);
      const { data: updatedBranch } = await api.put(`/branches/${editingBranch.id}`, {
        latitude: lat,
        longitude: lng,
        address: values.address,
      });
      setBranches(branches.map(b => b.id === editingBranch.id ? updatedBranch : b));
      invalidateCache('branches');
      message.success("Branch location updated successfully!");
      setIsEditModalVisible(false);
      setEditingBranch(null);
      editFormInstance.resetFields();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || error?.response?.data?.message || "Failed to update branch location");
    } finally {
      setIsGeocoding(false);
    }
  };

  const columns = [
    {
      title: "Branch",
      key: "name",
      render: (_, r) => (
        <div>
          <div className="font-semibold">{r.name}</div>
          <div className="text-xs text-gray-400">{r.code}</div>
        </div>
      ),
    },
    {
      title: "Address",
      key: "address",
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <EnvironmentOutlined className="text-gray-400" />
          <span>{r.address || <span className="text-gray-400">No address</span>}</span>
        </div>
      ),
    },
    {
      title: "Location Status",
      key: "status",
      render: (_, r) =>
        r.latitude && r.longitude
          ? <Tag color="green">Located</Tag>
          : <Tag color="orange">No Location</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit Location">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditLocation(r)}>
              Edit Location
            </Button>
          </Tooltip>
          {r.latitude && r.longitude && (
            <>
              <Button size="small" type="primary" ghost onClick={() => handleOpenGoogleMaps(r)}>
                Google Maps
              </Button>
              <Button size="small" type="primary" ghost onClick={() => handleOpenOpenStreetMap(r)}>
                OpenStreetMap
              </Button>
            </>
          )}
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
                <EnvironmentOutlined className="mr-2" />
                Branch Locations Map
              </h1>
              <p className="text-white/80 text-sm">View all branch locations on an interactive map</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Branches</p>
              <p className="text-white font-bold text-xl">{branches.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">With Location</p>
              <p className="text-white font-bold text-xl">{branchesWithLocation.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Missing Location</p>
              <p className="text-white font-bold text-xl">{branchesWithoutLocation.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - FoodMeal Style */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <Space wrap>
          <Input
            placeholder="Search branch name or address..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300 }}
            allowClear
            className="rounded-xl"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadBranches(true)}
            loading={loading}
            className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Map Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <EnvironmentOutlined className="mr-2 text-[#E53935]" />
              Interactive Map
            </h2>
            <p className="text-sm text-gray-500 mt-1">Click markers for branch details</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {branchesWithLocation.length} located
          </Tag>
        </div>
      </div>

      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm" styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E53935] mx-auto"></div>
              <p className="text-gray-500 mt-4">Loading map...</p>
            </div>
          </div>
        ) : branchesWithLocation.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <EnvironmentOutlined className="text-6xl text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg mb-2">No branch locations found</p>
            <p className="text-gray-400">Add latitude and longitude to branches to see them on the map</p>
          </div>
        ) : (
          <div className="h-[500px] w-full md:h-[600px] lg:h-[700px]">
            <MapContainer
              key={branchesWithLocation.length}
              center={[14.5995, 120.9842]}
              zoom={10}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
            >
              <MapInitializer />
              <MapFlyTo branch={flyTarget} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBounds branches={branchesWithLocation} />
              <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterCustomIcon}>
                {branchesWithLocation.map((branch) => (
                  <Marker
                    key={branch.id}
                    position={[branch.latitude, branch.longitude]}
                    icon={customIcon}
                    eventHandlers={{ click: () => handleMarkerClick(branch) }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <h3 className="font-bold text-lg text-gray-800 mb-2">{branch.name}</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <EnvironmentOutlined className="text-gray-500 mt-0.5" />
                            <span className="text-gray-600">{branch.address || 'No address'}</span>
                          </div>
                          {branch.phone && (
                            <div className="flex items-start gap-2">
                              <PhoneOutlined className="text-gray-500 mt-0.5" />
                              <span className="text-gray-600">{branch.phone}</span>
                            </div>
                          )}
                          {branch.email && (
                            <div className="flex items-start gap-2">
                              <MailOutlined className="text-gray-500 mt-0.5" />
                              <span className="text-gray-600">{branch.email}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-gray-200 flex gap-2">
                            <Button size="small" type="link" onClick={() => handleOpenGoogleMaps(branch)}>
                              Google Maps
                            </Button>
                            <Button size="small" type="link" onClick={() => handleOpenOpenStreetMap(branch)}>
                              OpenStreetMap
                            </Button>
                            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEditLocation(branch)} />
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        )}
      </Card>

      {/* Branches Missing Location - FoodMeal Style */}
      {branchesWithoutLocation.length > 0 && (
        <Card className="mb-6 rounded-xl border border-[#FFEBEE] shadow-sm" style={{ borderLeft: '3px solid #E53935' }}>
          <div className="flex items-center gap-2 mb-3">
            <EnvironmentOutlined className="text-[#E53935]" />
            <span className="font-semibold text-[#E53935]">Branches Missing Location Data ({branchesWithoutLocation.length})</span>
          </div>
          <div className="space-y-2">
            {branchesWithoutLocation.map((branch) => (
              <div key={branch.id} className="flex items-center justify-between bg-[#FFEBEE]/30 rounded-xl p-3 border border-[#FFEBEE]">
                <div>
                  <p className="font-medium text-[#1A237E]">{branch.name}</p>
                  <p className="text-xs text-gray-500">{branch.address || 'No address'}</p>
                </div>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditLocation(branch)}
                  className="rounded-xl"
                >
                  Add Location
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All Branches Table Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <EnvironmentOutlined className="mr-2 text-[#E53935]" />
              All Branches
            </h2>
            <p className="text-sm text-gray-500 mt-1">Complete list of all registered branches</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {filteredBranches.length} branch{filteredBranches.length !== 1 ? 'es' : ''}
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#E3F2FD] shadow-sm">
        <div ref={tableRef}>
          <Table
            columns={columns}
            dataSource={filteredBranches}
            rowKey="id"
            rowClassName={(record) => record.id === selectedBranch?.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: record.latitude && record.longitude ? "pointer" : "default" },
            })}
            pagination={{ pageSize: 5, showSizeChanger: true, showTotal: (t) => `Total ${t} branches` }}
            locale={{ emptyText: <div className="py-8 text-center"><EnvironmentOutlined className="text-4xl text-gray-300 mb-2" /><p className="text-gray-500">No branches found</p><p className="text-gray-400 text-sm">Try adjusting your search</p></div> }}
          />
        </div>
      </Card>

      {/* Edit Location Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <EditOutlined className="mr-2 text-[#1565C0]" />
            <span className="text-[#1A237E] font-bold">{editingBranch?.name} - Set Location</span>
          </span>
        }
        open={isEditModalVisible}
        onCancel={() => { setIsEditModalVisible(false); setEditingBranch(null); editFormInstance.resetFields(); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={editFormInstance} layout="vertical" onFinish={handleSaveLocation}>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Address</span>}
            name="address"
            rules={[{ required: true, message: "Please enter an address" }]}
          >
            <Input
              placeholder="e.g., 123 Main St, Manila, Philippines"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#E3F2FD]">
            <p className="text-xs text-[#1A237E] mb-0">
              <InfoCircleOutlined className="mr-1" />
              Enter a complete address including street, city, and country for accurate location detection.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setIsEditModalVisible(false); setEditingBranch(null); editFormInstance.resetFields(); }}
                disabled={isGeocoding}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isGeocoding}
                className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
              >
                Save Location
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BranchMap;
