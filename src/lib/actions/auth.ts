"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

/** 登录：Auth.js Credentials，失败返回错误文案，成功后跳转到首页 */
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "邮箱或密码错误，请重试";
    }
    // 登录成功时 signIn 内部会抛出 NEXT_REDIRECT，必须继续抛出
    throw error;
  }
}

/** 退出登录并回到首页 */
export async function logout() {
  await signOut({ redirectTo: "/" });
}
