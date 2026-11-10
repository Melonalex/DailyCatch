import logging
import time

import requests

logger = logging.getLogger(__name__)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "DailyCatch/1.0"})


def request_with_retries(
    method: str,
    url: str,
    *,
    timeout: float = 10,
    retries: int = 2,
    **kwargs,
) -> requests.Response:
    last_error: Exception | None = None
    attempts = retries + 1
    for attempt in range(1, attempts + 1):
        try:
            response = SESSION.request(method, url, timeout=timeout, **kwargs)
            if response.status_code == 429 or response.status_code >= 500:
                raise requests.HTTPError(
                    f"HTTP {response.status_code} for {url}",
                    response=response,
                )
            response.raise_for_status()
            return response
        except requests.RequestException as exc:
            last_error = exc
            logger.warning(
                "Request failed (%s/%s) %s %s: %s",
                attempt,
                attempts,
                method,
                url,
                exc,
            )
            if attempt < attempts:
                time.sleep(0.5)
    assert last_error is not None
    raise last_error
