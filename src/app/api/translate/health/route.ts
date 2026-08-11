import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import { toNextResponse, handleRouteError } from "@/backend/api/route-helpers";

export async function GET(request: NextRequest) {
  try {
    return toNextResponse(await getControllers().translation.getHealth());
  } catch (error) {
    return handleRouteError(error);
  }
}
