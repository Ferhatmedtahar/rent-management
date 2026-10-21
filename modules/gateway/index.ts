/**
 * PUBLIC API of the gateway module. Client-safe only: never re-export
 * services, repositories or adapters from here.
 */
export { BillReturnScreenContainer } from "./screens/bill-return-screen-container";
export { createGatewayBill } from "./services/gateway-api.service";
export type { BillView } from "./types/gateway.types";
