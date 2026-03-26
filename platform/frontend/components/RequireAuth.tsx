import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../src/services/api';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * 路由守卫组件
 * 检查用户是否已登录，未登录则重定向到登录页
 */
export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = api.auth.isAuthenticated();

  if (!isAuthenticated) {
    // 未登录，重定向到登录页，并保存当前路径以便登录后跳转回来
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
