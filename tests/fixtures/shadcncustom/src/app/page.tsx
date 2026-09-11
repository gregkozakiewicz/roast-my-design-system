import { LoginForm } from "@/components/login-form"
import { Panel } from "@/components/shared/Panel"
import { PrimaryButton } from "@/components/shared/PrimaryButton"
import { StatusPill } from "@/components/shared/StatusPill"

export default function Page() {
  return (
    <main className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 p-6">
      <LoginForm />
      <Panel />
      <PrimaryButton>Go</PrimaryButton>
      <StatusPill ok />
      <div className="mt-4 border-b border-gray-200 pb-2 text-sm text-gray-500">Footer in tin greys</div>
    </main>
  )
}
