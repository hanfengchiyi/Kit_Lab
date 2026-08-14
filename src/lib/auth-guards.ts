import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * 页面级登录 / 管理员守卫：统一重定向逻辑，供服务端页面开头调用。
 * 注意：只能用于页面组件（redirect 要求），Server Actions 请用 actions 内的权限校验。
 */
export async function requireUserPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }
  return session.user;
}
