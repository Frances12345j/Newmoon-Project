import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Card, Typography } from "antd";
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from "@ant-design/icons";
import { api } from "../config/api";
import logo from "../assets/logooos.jpg";

const { Title, Text } = Typography;

function Login() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (values) => {
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/admin/login", {
        username: values.username,
        password: values.password,
      });

      const { token, user, role } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("role", role || user?.role || "");
      localStorage.setItem("isLoggedIn", "true");

      if ((role || user?.role) === "admin") {
        navigate("/dashboard");
      } else {
        navigate("/staff-dashboard");
      }
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        "Unable to connect to backend. Check API URL and server.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        padding: 16,
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          overflow: "hidden",
          border: "none",
        }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            padding: "32px 24px 28px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              overflow: "hidden",
              margin: "0 auto 16px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              border: "3px solid rgba(255,255,255,0.3)",
            }}
          >
            <img
              src={logo}
              alt="New Moon Lechon Manok & Liempo"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <Title level={3} style={{ color: "#fff", margin: 0, fontWeight: 700 }}>
            Welcome Back
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 4, display: "block" }}>
            Sign in to continue to your account
          </Text>
        </div>

        {/* Form */}
        <div style={{ padding: "28px 24px 32px" }}>
          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              closable
              onClose={() => setError("")}
              style={{ marginBottom: 20, borderRadius: 8 }}
            />
          )}

          <Form
            form={form}
            layout="vertical"
            onFinish={handleLogin}
            requiredMark={false}
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: "Please enter your username" }]}
              style={{ marginBottom: 20 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: "#bfbfbf" }} />}
                placeholder="Username"
                autoFocus
                style={{ borderRadius: 8, height: 44 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: "Please enter your password" }]}
              style={{ marginBottom: 8 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "#bfbfbf" }} />}
                placeholder="Password"
                iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                style={{ borderRadius: 8, height: 44 }}
              />
            </Form.Item>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 24,
              }}
            >
              <Button
                type="link"
                style={{ padding: 0, fontSize: 13 }}
              >
                Forgot password?
              </Button>
            </div>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  height: 46,
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 15,
                  boxShadow: "0 4px 14px rgba(102, 126, 234, 0.4)",
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </div>
      </Card>
    </div>
  );
}

export default Login;
