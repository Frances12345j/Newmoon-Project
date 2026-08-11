import React from "react";
import { Layout } from "antd";
import MenuSidebar from "../MENU/Menu";

const { Content } = Layout;

function MenuLayout({ children }) {
  return (
    <Layout style={{ minHeight: "100vh", overflow: "hidden" }}>
      <MenuSidebar />
      <Layout style={{ flex: 1, overflow: "hidden" }}>
        <Content 
          style={{ 
            background: "#dedde2", 
            overflow: "auto",
            padding: "24px",
            height: "100vh",
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default MenuLayout;