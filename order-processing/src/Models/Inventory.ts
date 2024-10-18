import { Clock, Instant } from "@js-joda/core";

export type StockItem = {
    sku: string,
    quantity: number
};

export type FailedStockItem = {
    sku: string,
    desired_quantity: number
    available_quantity: number
};

export type BulkReserveItemsFromInventory = {
    _named: "BulkReserveItemsFromInventory",
    for_order_id: string,
    items: StockItem[]
};

export type BulkReserveItemsFromInventorySucceeded = {
    _named: "BulkReserveItemsFromInventorySucceeded",
    for_order_id: string,
    items: StockItem[],
    when: Instant
};

export type BulkReserveItemsFromInventoryFailed = {
    _named: "BulkReserveItemsFromInventoryFailed",
    for_order_id: string,
    failed_to_reserve_stock_for_items: FailedStockItem[],
    when: Instant
};

export type BulkReceiveItemsIntoInventory = {
    _named: "BulkReceiveItemsIntoInventory",
    items: StockItem[]
};

export type BulkReceivedItemsIntoInventory = {
    _named: "BulkReceivedItemsIntoInventory",
    items: StockItem[],
    when: Instant
};

export type InventoryCommand =
    | BulkReceiveItemsIntoInventory
    | BulkReserveItemsFromInventory

export type InventoryEvent =
    | BulkReceivedItemsIntoInventory
    | BulkReserveItemsFromInventorySucceeded
    | BulkReserveItemsFromInventoryFailed

export const InventoryCommandNames = [ "BulkReceiveItemsIntoInventory", "BulkReserveItemsFromInventory" ] as const;
export const InventoryEventNames = [ "BulkReceivedItemsIntoInventory", "BulkReserveItemsFromInventorySucceeded", "BulkReserveItemsFromInventoryFailed" ] as const;

export type InventoryState = { items: Map<string, number> };

export function inventory(clock: Clock) {
    return {
        initialState() : InventoryState { return { items: new Map() }; },
        evolve: (state: InventoryState, event: InventoryEvent) => {
            switch(event._named){
                case "BulkReceivedItemsIntoInventory":
                    for (let item of event.items) {
                        let stocked_quantity = state.items.get(item.sku) || 0;
                        state.items.set(item.sku, stocked_quantity + item.quantity);
                    }
                    break;
                case "BulkReserveItemsFromInventorySucceeded":
                    for (let item of event.items) {
                        let stocked_quantity = state.items.get(item.sku) || 0;
                        state.items.set(item.sku, stocked_quantity - item.quantity);
                    }
                    break;
            }
            return state;
        },
        decide: (command: InventoryCommand, state: InventoryState) => {
            const now = Instant.now(clock);
            let events: InventoryEvent[] = [];
            switch(command._named){
                case "BulkReceiveItemsIntoInventory":
                    events.push({
                        _named: "BulkReceivedItemsIntoInventory",
                        items: command.items,
                        when: now
                    });
                    break;
                case "BulkReserveItemsFromInventory":
                    let failed_items: FailedStockItem[] = [];
                    for (let item of command.items) {
                        let stocked_quantity = state.items.get(item.sku) || 0;
                        if (stocked_quantity < item.quantity) {
                            failed_items.push({
                                sku: item.sku,
                                desired_quantity: item.quantity,
                                available_quantity: stocked_quantity
                            });
                        }
                    }
                    if (failed_items.length > 0) {
                        events.push({
                            _named: "BulkReserveItemsFromInventoryFailed",
                            for_order_id: command.for_order_id,
                            failed_to_reserve_stock_for_items: failed_items,
                            when: now
                        });
                    } else {
                        events.push({
                            _named: "BulkReserveItemsFromInventorySucceeded",
                            for_order_id: command.for_order_id,
                            items: command.items,
                            when: now
                        });
                    }
                    break;
            }
            return events;
        }
    }
}