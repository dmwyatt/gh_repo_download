import pytest
from django.core.management import call_command
from django.test import override_settings
from playwright.async_api import expect

timeout = 6_000

expect.set_options(timeout=timeout)


@pytest.fixture
def context(context):
    context.set_default_timeout(timeout)
    yield context


@pytest.fixture(scope="session", autouse=True)
def staticfiles(tmp_path_factory):
    static_root = tmp_path_factory.mktemp("static")
    with override_settings(STATIC_ROOT=static_root):
        call_command("collectstatic", "--noinput")
        yield
