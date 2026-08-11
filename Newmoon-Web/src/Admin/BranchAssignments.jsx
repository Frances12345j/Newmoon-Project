import { useState } from "react";
import { Card, Table, Tag, Button, Modal, Form, Input, Select, Space, message, Tooltip, Switch } from "antd";
import {
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BankOutlined,
  TeamOutlined,
  ReloadOutlined,
  CarOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "../config/api";

const fetchStaff = async () => {
  try {
    const response = await api.get("/staff?paginate=false");
    if (response.data?.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    return Array.isArray(response.data) ? response.data : [];
  } catch (e) {
    console.error("Failed to fetch staff:", e);
    return [];
  }
};

const fetchAssignments = async () => {
  try {
    const response = await api.get("/staff-assignments?paginate=false");
    if (response.data?.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    return Array.isArray(response.data) ? response.data : [];
  } catch (e) {
    console.error("Failed to fetch assignments:", e);
    return [];
  }
};

const fetchBranches = async () => {
  try {
    const response = await api.get("/branches");
    const branchesData = response.data?.data;
    return Array.isArray(branchesData) ? branchesData : (Array.isArray(response.data) ? response.data : []);
  } catch (e) {
    console.error("Failed to fetch branches:", e);
    return [];
  }
};

const createAssignment = async (data) => {
  const response = await api.post("/staff-assignments", data);
  return response.data;
};

const updateAssignment = async ({ id, data }) => {
  const response = await api.put(`/staff-assignments/${id}`, data);
  return response.data;
};

const deleteAssignment = async (id) => {
  const response = await api.delete(`/staff-assignments/${id}`);
  return response.data;
};

const toggleAssignmentStatus = async ({ id, is_active }) => {
  const response = await api.put(`/staff-assignments/${id}`, { is_active });
  return response.data;
};

function BranchAssignments() {
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: fetchAssignments,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const loading = staffLoading || assignmentsLoading || branchesLoading;

  const staffList = Array.isArray(staff) ? staff : [];
  const branchesList = Array.isArray(branches) ? branches : [];
  const staffOnly = staffList.filter(user => user.role === 'staff');
  const riders = staffList.filter(user => user.role === 'delivery_rider');
  const allUsers = [...staffOnly, ...riders];

  const usersWithAssignment = allUsers.map((user) => {
    const assignment = assignments.find((a) => a.user_id === user.id && a.is_active) ||
                       assignments.find((a) => a.user_id === user.id);
    return {
      ...user,
      assignment: assignment || null,
      branch: assignment?.branch || null,
      position: assignment?.position || "Unassigned",
      daily_rate: assignment?.daily_rate || 0,
      is_active: assignment?.is_active ?? false,
    };
  });

  const totalStaff = staffOnly.length;
  const totalRiders = riders.length;
  const totalUsers = allUsers.length;
  const assignedCount = usersWithAssignment.filter((u) => u.assignment).length;
  const unassignedCount = totalUsers - assignedCount;
  const totalBranches = branchesList.length;

  const addMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      message.success("Branch assignment added successfully");
      setShowAddModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to add branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to add branch assignment");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAssignment,
    onSuccess: () => {
      message.success("Branch assignment updated successfully");
      setShowEditModal(false);
      setEditingAssignment(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to update branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to update branch assignment");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      message.success("Branch assignment deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || "Failed to delete branch assignment");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAssignmentStatus,
    onSuccess: (data, variables) => {
      message.success(variables.is_active ? "Assignment activated." : "Assignment deactivated.");
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || "Failed to update assignment status.");
    },
  });

  const handleAddAssignment = async (values) => {
    if (!values.user_id || !values.branch_id) {
      message.error("Please select both a user and a branch");
      return;
    }
    const selectedUser = allUsers.find(u => u.id === Number(values.user_id));
    const defaultPosition = selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff';
    const defaultRate = selectedUser?.role === 'delivery_rider' ? 400 : 500;
    const payload = {
      user_id: Number(values.user_id),
      branch_id: Number(values.branch_id),
      position: values.position || defaultPosition,
      daily_rate: values.daily_rate ? Number(values.daily_rate) : defaultRate,
      is_active: true,
    };
    await addMutation.mutateAsync(payload);
  };

  const handleUpdateAssignment = async (values) => {
    if (!values.user_id || !values.branch_id) {
      message.error("Please select both a user and a branch");
      return;
    }
    const selectedUser = allUsers.find(u => u.id === Number(values.user_id));
    const defaultPosition = selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff';
    const defaultRate = selectedUser?.role === 'delivery_rider' ? 400 : 500;
    const payload = {
      id: editingAssignment.id,
      data: {
        user_id: Number(values.user_id),
        branch_id: Number(values.branch_id),
        position: values.position || defaultPosition,
        daily_rate: values.daily_rate ? Number(values.daily_rate) : defaultRate,
      },
    };
    await updateMutation.mutateAsync(payload);
  };

  const handleDeleteAssignment = (record) => {
    Modal.confirm({
      title: "Delete Branch Assignment",
      icon: <DeleteOutlined className="text-red-500" />,
      content: (
        <div>
          <p className="mb-2">Are you sure you want to remove this branch assignment?</p>
          <p className="text-sm text-gray-500">User: <strong>{record.user?.firstname} {record.user?.lastname}</strong></p>
          <p className="text-sm text-gray-500">Branch: <strong>{record.branch?.name}</strong></p>
        </div>
      ),
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        await deleteMutation.mutateAsync(record.assignment.id);
      },
    });
  };

  const handleToggleAssignment = (record) => {
    const nextActive = !record.is_active;
    Modal.confirm({
      title: nextActive ? "Activate Branch Assignment" : "Deactivate Branch Assignment",
      content: (
        <div>
          <p className="mb-2">{nextActive ? "This user will be assigned to this branch." : "This user will no longer be assigned to this branch."}</p>
          <p className="text-sm text-gray-500">User: <strong>{record.user?.firstname} {record.user?.lastname}</strong></p>
          <p className="text-sm text-gray-500">Branch: <strong>{record.branch?.name}</strong></p>
        </div>
      ),
      okText: nextActive ? "Activate" : "Deactivate",
      okButtonProps: { danger: !nextActive },
      cancelText: "Cancel",
      onOk: async () => {
        await toggleMutation.mutateAsync({ id: record.assignment.id, is_active: nextActive });
      },
    });
  };

  const openEditModal = (record) => {
    setEditingAssignment(record);
    setShowEditModal(true);
    setTimeout(() => editForm.setFieldsValue({
      user_id: record.user_id,
      branch_id: record.branch_id,
      position: record.position,
      daily_rate: record.daily_rate,
    }), 0);
  };

  const columns = [
    {
      title: "No.",
      key: "index",
      width: 60,
      render: (_, __, idx) => <span className="text-gray-500">{idx + 1}</span>,
    },
    {
      title: "User",
      key: "user",
      render: (_, r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
            {r.firstname?.charAt(0)?.toUpperCase() || <UserOutlined />}
          </div>
          <div>
            <div className="font-semibold">{r.firstname} {r.lastname}</div>
            <div className="text-gray-400 text-xs">{r.username}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Type",
      key: "type",
      render: (_, r) =>
        r.role === 'delivery_rider'
          ? <Tag color="orange" icon={<CarOutlined />}>Rider</Tag>
          : <Tag color="blue" icon={<TeamOutlined />}>Staff</Tag>,
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, r) =>
        r.assignment
          ? <Tag color="green">{r.branch?.name || "N/A"}</Tag>
          : <Tag>Not Assigned</Tag>,
    },
    {
      title: "Position",
      key: "position",
      render: (_, r) => r.position || "—",
    },
    {
      title: "Daily Rate",
      key: "daily_rate",
      render: (_, r) => `₱${r.daily_rate || 0}`,
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) =>
        r.assignment
          ? r.is_active
            ? <Tag color="green">Active</Tag>
            : <Tag color="red">Inactive</Tag>
          : <Tag color="orange">Unassigned</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          {r.assignment ? (
            <>
              <Tooltip title={r.is_active ? "Deactivate" : "Activate"}>
                <Switch
                  checked={r.is_active}
                  onChange={() => handleToggleAssignment(r)}
                  loading={toggleMutation.isPending}
                  size="small"
                />
              </Tooltip>
              <Tooltip title="Edit Assignment">
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)} />
              </Tooltip>
              <Tooltip title="Delete Assignment">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAssignment(r)} />
              </Tooltip>
            </>
          ) : (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => {
              setShowAddModal(true);
              setTimeout(() => form.setFieldsValue({ user_id: r.id }), 0);
            }}>
              Assign
            </Button>
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
                <BankOutlined className="mr-2" />
                Branch Assignments
              </h1>
              <p className="text-white/80 text-sm">Manage staff and rider branch assignments</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Staff</p>
              <p className="text-white font-bold text-xl">{totalStaff}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Riders</p>
              <p className="text-white font-bold text-xl">{totalRiders}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Assigned</p>
              <p className="text-white font-bold text-xl">{assignedCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Unassigned</p>
              <p className="text-white font-bold text-xl">{unassignedCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Branches</p>
              <p className="text-white font-bold text-xl">{totalBranches}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - FoodMeal Style */}
      <Card className="mb-6 rounded-xl border border-[#E3F2FD] shadow-sm">
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['staff'] });
              queryClient.invalidateQueries({ queryKey: ['assignments'] });
              queryClient.invalidateQueries({ queryKey: ['branches'] });
            }}
            loading={loading}
            className="rounded-xl border-[#1A237E] text-[#1A237E] hover:bg-[#E3F2FD]"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setShowAddModal(true);
            }}
            className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
          >
            Add Assignment
          </Button>
        </Space>
      </Card>

      {/* Table Section - FoodMeal Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1A237E]">
              <TeamOutlined className="mr-2 text-[#E53935]" />
              Staff & Riders Directory
            </h2>
            <p className="text-sm text-gray-500 mt-1">View and manage all member assignments</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#E53935] to-[#1A237E] text-white border-none">
            {totalUsers} {totalUsers === 1 ? "Member" : "Members"}
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#E3F2FD] shadow-sm">
        <Table
          columns={columns}
          dataSource={usersWithAssignment}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} members` }}
          locale={{ emptyText: <div className="py-8 text-center"><UserOutlined className="text-4xl text-gray-300 mb-2" /><p className="text-gray-500">No staff or riders found</p><p className="text-gray-400 text-sm">Add assignments to get started</p></div> }}
        />
      </Card>

      {/* Add Assignment Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <PlusOutlined className="mr-2 text-[#3f8600]" />
            <span className="text-[#1A237E] font-bold">Add Branch Assignment</span>
          </span>
        }
        open={showAddModal}
        onCancel={() => { setShowAddModal(false); form.resetFields(); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={form} layout="vertical" onFinish={handleAddAssignment} initialValues={{ position: "", daily_rate: "" }}>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">User</span>}
            name="user_id"
            rules={[{ required: true, message: "Please select a user" }]}
          >
            <Select
              placeholder="Select User"
              showSearch
              optionFilterProp="children"
              className="rounded-xl"
            >
              {allUsers.map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.firstname} {u.lastname} ({u.username}) - {u.role === 'delivery_rider' ? 'Rider' : 'Staff'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Branch</span>}
            name="branch_id"
            rules={[{ required: true, message: "Please select a branch" }]}
          >
            <Select
              placeholder="Select Branch"
              showSearch
              optionFilterProp="children"
              className="rounded-xl"
            >
              {branchesList.map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Position</span>}
            name="position"
          >
            <Input
              placeholder="Auto-filled based on role"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Daily Rate</span>}
            name="daily_rate"
          >
            <Input
              type="number"
              placeholder="Auto-filled based on role"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#E3F2FD]">
            <p className="text-xs text-[#1A237E] mb-0">
              <InfoCircleOutlined className="mr-1" />
              Position and daily rate are auto-filled based on the selected user's role. You can override them manually.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowAddModal(false); form.resetFields(); }}
                disabled={addMutation.isPending}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={addMutation.isPending}
                className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
              >
                Add Assignment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Assignment Modal - FoodMeal Style */}
      <Modal
        title={
          <span>
            <EditOutlined className="mr-2 text-[#1565C0]" />
            <span className="text-[#1A237E] font-bold">Edit Branch Assignment</span>
          </span>
        }
        open={showEditModal}
        onCancel={() => { setShowEditModal(false); setEditingAssignment(null); editForm.resetFields(); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateAssignment}>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">User</span>}
            name="user_id"
            rules={[{ required: true, message: "Please select a user" }]}
          >
            <Select
              placeholder="Select User"
              showSearch
              optionFilterProp="children"
              className="rounded-xl"
            >
              {allUsers.map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.firstname} {u.lastname} ({u.username}) - {u.role === 'delivery_rider' ? 'Rider' : 'Staff'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Branch</span>}
            name="branch_id"
            rules={[{ required: true, message: "Please select a branch" }]}
          >
            <Select
              placeholder="Select Branch"
              showSearch
              optionFilterProp="children"
              className="rounded-xl"
            >
              {branchesList.map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Position</span>}
            name="position"
          >
            <Input
              placeholder="Enter position"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item
            label={<span className="text-[#1A237E] font-medium">Daily Rate</span>}
            name="daily_rate"
          >
            <Input
              type="number"
              placeholder="Enter daily rate"
              className="rounded-xl border-[#E3F2FD] focus:border-[#E53935]"
            />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowEditModal(false); setEditingAssignment(null); editForm.resetFields(); }}
                disabled={updateMutation.isPending}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateMutation.isPending}
                className="rounded-xl bg-gradient-to-br from-[#E53935] to-[#1A237E] border-none shadow-[0_4px_15px_rgba(229,57,53,0.3)] hover:opacity-90"
              >
                Update Assignment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BranchAssignments;
