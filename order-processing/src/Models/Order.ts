import { Clock, Instant } from "@js-joda/core";

export type OrderLineItem = {
    line_item_id: string,
    product_id: string,
    quantity: number
    unitPrice: string
};

export type PlaceOrder = {
    _named: "PlaceOrder",
    order_id: string,
    from_cart_id: string,
    customer_id: string,
    items: OrderLineItem[]
};

export type OrderPlaced = {
    _named: "OrderPlaced",
    order_id: string,
    from_cart_id: string,
    customer_id: string,
    items: OrderLineItem[],
    when: Instant
};

export type ConfirmOrder = {
    _named: "ConfirmOrder",
    order_id: string
};

export type OrderConfirmed = {
    _named: "OrderConfirmed",
    order_id: string,
    customer_id: string,
    items: OrderLineItem[],
    when: Instant
};

export type CancelOrder = {
    _named: "CancelOrder",
    order_id: string
};

export type OrderCancelled = {
    _named: "OrderCancelled",
    order_id: string,
    customer_id: string,
    when: Instant
};

export type OrderCommand =
    | PlaceOrder
    | ConfirmOrder
    | CancelOrder

export type OrderEvent =
    | OrderPlaced
    | OrderConfirmed
    | OrderCancelled

export const OrderCommandNames = [ "PlaceOrder", "ConfirmOrder", "CancelOrder" ] as const;
export const OrderEventNames = [ "OrderPlaced", "OrderConfirmed", "OrderCancelled" ] as const;

export type Initially = { _named: "Initially" }
export type OncePlaced = { _named: "OncePlaced", customer: string, items: OrderLineItem[] }
export type Confirmed = { _named: "Confirmed" }
export type GotCancelled = { _named: "GotCancelled" }

export type OrderState =
    | Initially
    | OncePlaced
    | Confirmed
    | GotCancelled

export function order(clock: Clock) {
    return {
        initialState() : OrderState { return { _named: "Initially" }; },
        evolve: (state: OrderState, event: OrderEvent) => {
            let next : OrderState = state;
            switch(event._named){
                case "OrderPlaced":
                    next = { 
                        _named: "OncePlaced", 
                        customer: event.customer_id,
                        items: event.items
                    };
                    break;
                case "OrderConfirmed":
                    next = { _named: "Confirmed" };
                    break;
                case "OrderCancelled":
                    next = { _named: "GotCancelled" };
                    break;
            }
            return next;
        },
        decide: (command: OrderCommand, state: OrderState) => {
            const now = Instant.now(clock);
            let events: OrderEvent[] = [];
            switch (state._named) {
                case "Initially":
                    switch (command._named) {
                        case "PlaceOrder":
                            events.push({
                                    _named: "OrderPlaced",
                                    order_id: command.order_id,
                                    from_cart_id: command.from_cart_id,
                                    customer_id: command.customer_id,
                                    items: command.items,
                                    when: now
                            });

                            break;
                    }
                    break;
                case "OncePlaced":
                    switch (command._named) {
                        case "ConfirmOrder":
                            events.push({
                                _named: "OrderConfirmed",
                                order_id: command.order_id,
                                customer_id: state.customer,
                                items: state.items,
                                when: now
                            });
                            break;
                        case "CancelOrder":
                            events.push({
                                _named: "OrderCancelled",
                                order_id: command.order_id,
                                customer_id: state.customer,
                                when: now
                            });
                            break;
                    }
                    break;
            }
            return events;
        }
    }
}