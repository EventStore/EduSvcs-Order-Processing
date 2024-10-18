import { Clock } from "@js-joda/core";
import { OrderHandler } from "./OrderHandler";
import { InventoryHandler } from "./InventoryHandler";
import { ProcessOrderHandler } from "./ProcessOrderHandler";
import { OrderPersistentSubscriber } from "./OrderPersistentSubscriber";
import { InventoryPersistentSubscriber } from "./InventoryPersistentSubscriber";
import { ProcessOrderPersistentSubscriber } from "./ProcessOrderPersistentSubscriber";

export type CompositionRoot = {
    OrderHandler: OrderHandler,
    InventoryHandler: InventoryHandler,
    ProcessOrderHandler: ProcessOrderHandler,
    OrderPersistentSubscriber: OrderPersistentSubscriber,
    InventoryPersistentSubscriber: InventoryPersistentSubscriber,
    ProcessOrderSubscriber: ProcessOrderPersistentSubscriber
};

export function compose(clock: Clock) : CompositionRoot {
    return {
        OrderHandler: new OrderHandler(clock),
        InventoryHandler: new InventoryHandler(clock),
        ProcessOrderHandler: new ProcessOrderHandler(),
        OrderPersistentSubscriber: new OrderPersistentSubscriber(
            "order-subscriber",
            clock
        ),
        InventoryPersistentSubscriber: new InventoryPersistentSubscriber(
            "inventory-subscriber",
            clock
        ),
        ProcessOrderSubscriber: new ProcessOrderPersistentSubscriber(
            "process-order-subscriber"
        )
    };
};