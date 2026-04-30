import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { redirectIfAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell title="创建后台账号" description="注册仍然依赖管理员发放的注册码，角色权限由后端统一控制。" footer={<span>注册完成后会自动跳转到新的登录页。</span>}>
      <RegisterForm />
    </AuthShell>
  );
}
