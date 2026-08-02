import asyncio
from typing import Callable, Dict, List, Any
from config.logger import logger

class AsyncEventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler {handler.__name__} to event '{event_type}'")

    async def publish(self, event_type: str, data: Any):
        logger.info(f"Publishing event '{event_type}'")
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Error handling event '{event_type}' in {handler.__name__}: {e}")

event_bus = AsyncEventBus()
