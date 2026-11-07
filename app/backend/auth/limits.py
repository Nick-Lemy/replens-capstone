from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request


_attempts = defaultdict(deque)
_lock = Lock()


def limit(request: Request, action: str, identity: str, count: int, window: int):
    address = request.client.host if request.client else "unknown"
    current = monotonic()
    with _lock:
        for key, maximum, duration in (
            (("all", address, ""), 40, 600),
            ((action, address, identity), count, window),
        ):
            attempts = _attempts[key]
            while attempts and current - attempts[0] >= duration:
                attempts.popleft()
            if len(attempts) >= maximum:
                raise HTTPException(429, "Too many attempts. Try again later")
        _attempts[("all", address, "")].append(current)
        _attempts[(action, address, identity)].append(current)
