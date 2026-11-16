import {purchaseLicense} from '@/lib/purchase-license';
import {prisma} from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { ApiError, type SessionUser } from "@/lib/access-rules";
export { ApiError, assertOwnsResource, type SessionUser } from "@/lib/access-rules";

/**
 * Every protected route MUST call this — never trust a role or user id
 * that arrives in the request body/query. This is the single source of
 * truth for "who is calling this endpoint", resolved server-side from
 * the signed session cookie/JWT.
 */
export async function requireActivation(): Promise<void> {
  if(process.env.ACTIVATION_REQUIRED==="true"&&!(await purchaseLicense.status()).valid)throw new ApiError(402,"Activate this purchased installation first.");
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user?.id) {
    throw new ApiError(401, "Authentication required");
  }
  const current=await prisma.user.findUnique({where:{id:user.id},select:{id:true,role:true,username:true,isActive:true}});
  if(!current?.isActive)throw new ApiError(401,"Authentication required");
  await requireActivation();
  return {id:current.id,role:current.role,username:current.username};
}

export async function requireTeacher(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "TEACHER") {
    throw new ApiError(403, "Teacher/admin access required");
  }
  return user;
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("API Error:", err);
  const message = "The request could not be completed. Please retry.";
  return NextResponse.json({ error: message }, { status: 500 });
}
