import { nanoid } from "nanoid";
import type {
  ClosePositionRequest,
  ClosePositionResult,
  ExecutionProvider,
  SubmitOrderRequest,
  SubmitOrderResult,
} from "../executionTypes.js";

export class PaperExecutionProvider implements ExecutionProvider {
  async submitOrder(request: SubmitOrderRequest): Promise<SubmitOrderResult> {
    if (request.marginUsdt <= 0 || request.notionalUsdt <= 0) {
      return {
        success: false,
        externalOrderId: `paper_reject_${nanoid(8)}`,
        rejectReason: "模拟拒绝：下单参数无效",
      };
    }

    return {
      success: true,
      externalOrderId: `paper_${nanoid(10)}`,
      fillPrice: request.symbol.includes("BTC") ? 63000 : 100,
    };
  }

  async closePosition(_request: ClosePositionRequest): Promise<ClosePositionResult> {
    return {
      success: true,
      externalOrderId: `paper_close_${nanoid(10)}`,
    };
  }
}

