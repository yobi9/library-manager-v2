import { NextRequest } from "next/server";
import { getControllers } from "@/backend/controllers";
import {
  requireAdmin,
  toNextResponse,
  handleRouteError,
  errorResponse,
} from "@/backend/api/route-helpers";

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const form = await request.formData();
    const file = form.get("licenseFile");
    const content = file instanceof File ? await file.text() : null;
    if (!content) return errorResponse("No file uploaded", 400);
    const { license } = getControllers();
    return toNextResponse(await license.activateFile(content));
  } catch (error) {
    return handleRouteError(error);
  }
}
