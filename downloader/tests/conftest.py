import os

import nest_asyncio
import pytest

os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")

from playwright.sync_api import expect

timeout = 6_000

expect.set_options(timeout=timeout)


def pytest_configure():
    # https://github.com/microsoft/playwright-pytest/issues/167#issuecomment-1546854047
    nest_asyncio.apply()


@pytest.fixture
def context(context):
    context.set_default_timeout(timeout)
    yield context
