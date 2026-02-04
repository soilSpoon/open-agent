import { NextResponse } from "next/server";
import { ralphWorker } from "@/lib/worker";

let workerStarted = false;

export async function GET() {
  if (!workerStarted) {
    console.log("[API/Worker] Starting Ralph Background Worker...");
    ralphWorker.start();
    workerStarted = true;
  }

  return NextResponse.json({ status: "Worker is active", concurrency: 20 });
}
