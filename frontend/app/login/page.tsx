"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Command, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";

const schema = z.object({ email: z.string().email("Enter a valid email address"), password: z.string().min(1, "Enter your password") });
type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuth((state) => state.setAuth);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  async function submit(values: Values) {
    setServerError("");
    try {
      const tokens = await api.login(values.email, values.password);
      setAuth(tokens, { id: "", email: values.email, name: values.email.split("@")[0], timezone: "UTC", role: "member" });
      setAuth(tokens, await api.me());
      router.replace("/");
    } catch (error) { setServerError(error instanceof Error ? error.message : "Unable to sign in"); }
  }

  return <main className="grid min-h-screen bg-[#f5f6fa] lg:grid-cols-[1.04fr_.96fr]">
    <section className="relative hidden min-h-screen overflow-hidden bg-[#171923] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div className="pointer-events-none absolute -right-36 top-12 size-[520px] rounded-full bg-[#7659f6]/20 blur-[110px]"/><div className="pointer-events-none absolute -bottom-48 -left-36 size-[540px] rounded-full bg-[#2f9781]/15 blur-[120px]"/>
      <div className="relative flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[14px] bg-[#7659f6] shadow-[0_5px_24px_rgba(118,89,246,.45)]"><Command size={19}/></span><div><b className="text-[16px] tracking-tight">orbit<span className="text-[#b8a9ff]">.</span></b><span className="ml-3 border-l border-white/15 pl-3 text-[10px] font-medium tracking-wide text-white/45">TEAM WORKSPACE</span></div></div>
      <div className="relative mx-auto w-full max-w-[580px] py-12 xl:py-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.15em] text-white/65"><Sparkles size={12} className="text-[#b8a9ff]"/> Clarity for the work ahead</div>
        <h1 className="max-w-[520px] text-[42px] font-semibold leading-[1.08] tracking-[-.045em] xl:text-[54px]">Great work moves forward <span className="text-[#b8a9ff]">together.</span></h1>
        <p className="mt-5 max-w-[430px] text-[14px] leading-7 text-white/55">A quieter place to plan projects, share priorities, and keep your team’s momentum visible.</p>
        <div className="relative mt-12 grid grid-cols-[1.1fr_.9fr] gap-3">
          <div className="login-float rounded-[20px] border border-white/10 bg-white/[.075] p-4 shadow-2xl backdrop-blur"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/45">This week</span><span className="rounded-full bg-[#b8a9ff]/15 px-2 py-1 text-[9px] font-semibold text-[#c9beff]">On track</span></div><div className="mt-6 flex items-end justify-between"><div><div className="text-3xl font-semibold tracking-tight">24<span className="text-white/40">/32</span></div><div className="mt-1 text-[10px] text-white/45">tasks completed</div></div><div className="flex h-12 items-end gap-1">{[24, 33, 27, 42, 36, 48, 39, 50].map((height, index) => <span key={index} style={{ height: `${height}px` }} className={`w-2 rounded-full ${index > 5 ? "bg-[#a895ff]" : "bg-white/20"}`}/>)}</div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[74%] rounded-full bg-gradient-to-r from-[#8068f2] to-[#b5a5ff]"/></div></div>
          <div className="login-float-delayed rounded-[20px] border border-white/10 bg-[#242531]/90 p-4 shadow-2xl"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[#2f8d76]/20 text-[#72d2b5]"><Check size={14}/></span><span className="text-[10px] font-semibold text-white/65">Team momentum</span></div><div className="mt-5 flex -space-x-2">{["bg-[#e9d8c4]","bg-[#c9d4ef]","bg-[#d7c9ed]","bg-[#c6e3d8]"].map((color,index)=><span key={index} className={`grid size-8 place-items-center rounded-full border-2 border-[#242531] ${color} text-[9px] font-bold text-[#363342]`}>{["AL","JM","SK","+2"][index]}</span>)}</div><div className="mt-3 text-[10px] text-white/45">Good things happen in sync.</div></div>
          <div className="absolute -bottom-7 right-[34%] rounded-2xl border border-white/10 bg-[#262734] px-3.5 py-2.5 shadow-xl"><div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#55c29c]"/><span className="text-[10px] font-medium text-white/75">Platform launch</span><ArrowUpRight size={12} className="text-white/40"/></div></div>
        </div>
      </div>
      <div className="relative flex items-center justify-between text-[10px] text-white/35"><span>Thoughtful work starts with a clear view.</span><span>© 2026 Orbit</span></div>
    </section>

    <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
      <div className="w-full max-w-[390px]">
        <div className="mb-10 flex items-center gap-2.5 lg:hidden"><span className="grid size-9 place-items-center rounded-xl bg-[#7659f6] text-white"><Command size={17}/></span><b className="text-[15px] tracking-tight">orbit<span className="text-[#7659f6]">.</span></b></div>
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#7059df]"><span className="h-px w-5 bg-[#b8a9ff]"/> Welcome back</span>
        <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-.04em] text-[#202332]">Sign in to Orbit</h2>
        <p className="mt-2 text-[13px] leading-6 text-[#777b8a]">Your team’s next step is waiting.</p>
        <form onSubmit={handleSubmit(submit)} className="mt-8 space-y-5">
          <label className="block text-[12px] font-semibold text-[#303343]">Work email<input autoComplete="email" {...register("email")} placeholder="you@company.com" className="mt-2 h-12 w-full rounded-xl border border-[#e5e6ed] bg-white px-3.5 text-[13px] font-normal outline-none transition placeholder:text-[#b1b3be] focus:border-[#8a75f5] focus:ring-4 focus:ring-[#7659f6]/10"/>{errors.email && <span className="mt-1.5 block text-[11px] font-medium text-red-600">{errors.email.message}</span>}</label>
          <label className="block text-[12px] font-semibold text-[#303343]">Password<div className="relative mt-2"><input type="password" autoComplete="current-password" {...register("password")} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-[#e5e6ed] bg-white px-3.5 pr-10 text-[13px] font-normal outline-none transition placeholder:text-[#b1b3be] focus:border-[#8a75f5] focus:ring-4 focus:ring-[#7659f6]/10"/><LockKeyhole size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b1b3be]"/></div>{errors.password && <span className="mt-1.5 block text-[11px] font-medium text-red-600">{errors.password.message}</span>}</label>
          {serverError && <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-[12px] text-red-700">{serverError}</div>}
          <button type="submit" disabled={isSubmitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6a50e8] text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(106,80,232,.2)] transition hover:-translate-y-0.5 hover:bg-[#5c43d6] disabled:translate-y-0 disabled:opacity-60">{isSubmitting && <LoaderCircle size={16} className="animate-spin"/>}Continue to workspace<ArrowUpRight size={15}/></button>
        </form>
        <div className="mt-8 flex items-start gap-2.5 border-t border-[#e8e9ef] pt-5"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-[#eeeaff] text-[#7059df]"><LockKeyhole size={12}/></span><p className="text-[11px] leading-5 text-[#898c9a]">Accounts are provisioned by a workspace owner. Contact your team lead if you need access.</p></div>
      </div>
    </section>
  </main>;
}
