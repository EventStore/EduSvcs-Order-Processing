import { WorkflowCommand, WorkflowEvent } from "./Framework/Workflow";
import { BulkReserveItemsFromInventory, BulkReserveItemsFromInventoryFailed, BulkReserveItemsFromInventorySucceeded } from "./Inventory";
import { CancelOrder, ConfirmOrder, OrderPlaced } from "./Order";

export type ProcessOrderInput =
    | OrderPlaced
    | BulkReserveItemsFromInventorySucceeded
    | BulkReserveItemsFromInventoryFailed;


export type ProcessOrderOutput =
    | BulkReserveItemsFromInventory
    | CancelOrder
    | ConfirmOrder;

export const ProcessOrderInputNames = [ "OrderPlaced", "BulkReserveItemsFromInventorySucceeded", "BulkReserveItemsFromInventoryFailed" ] as const;
export const ProcessOrderOutputNames = [ "BulkReserveItemsFromInventory", "CancelOrder", "ConfirmOrder" ] as const;

export type Initially = {
    _named: "Initially"
};

export type Placed = {
    _named: "Placed"
};

export type Reserved = {
    _named: "Reserved"
};

export type Cancelled = {
    _named: "Cancelled"
};

export type ProcessOrderState =
    | Initially
    | Placed
    | Reserved
    | Cancelled;

export function process_order() {
    return {
        initialState() : ProcessOrderState { return { _named: "Initially" }; },
        decide : (input: ProcessOrderInput, state: ProcessOrderState) => {
            let commands : WorkflowCommand<ProcessOrderOutput>[] = [];
            switch (state._named) {
                case "Initially":
                    switch (input._named) {
                        case "OrderPlaced":
                            commands.push({
                                _named: "send",
                                data: {
                                    _named: "BulkReserveItemsFromInventory",
                                    for_order_id: input.order_id,
                                    items: input.items.map(item => {
                                        return {
                                            sku: item.product_id,
                                            quantity: item.quantity
                                        };
                                    })
                                }
                            });

                            break;
                    }
                    break;
                case "Placed":
                    switch (input._named) {
                        case "BulkReserveItemsFromInventorySucceeded":
                            commands.push({
                                _named: "send",
                                data: {
                                    _named: "ConfirmOrder",
                                    order_id: input.for_order_id
                                }
                            });
                            commands.push({
                                _named: "complete"
                            });
                            break;
                        case "BulkReserveItemsFromInventoryFailed":
                            commands.push({
                                _named: "send",
                                data: {
                                    _named: "CancelOrder",
                                    order_id: input.for_order_id
                                }
                            });
                            commands.push({
                                _named: "complete"
                            });
                            break;
                    }
                    break;
            }
            return commands;
        },
        evolve : (state: ProcessOrderState, event: WorkflowEvent<ProcessOrderInput, ProcessOrderOutput>) => {
            let next = state;
            switch (event._named) {
                case "received":
                    switch (event.data._named) {
                        case "OrderPlaced":
                            next = { _named: "Placed" };
                            break;
                        case "BulkReserveItemsFromInventorySucceeded":
                            next = { _named: "Reserved" };
                            break;
                        case "BulkReserveItemsFromInventoryFailed":
                            next = { _named: "Cancelled" };
                            break;
                    }
                    break;
            }
            return next;
        }
    };
}