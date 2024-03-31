import os
import nest_asyncio

os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")


def pytest_configure():
    # https://github.com/microsoft/playwright-pytest/issues/167#issuecomment-1546854047
    nest_asyncio.apply()
