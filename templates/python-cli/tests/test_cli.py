from click.testing import CliRunner

from app.cli import main


def test_hello_default():
    runner = CliRunner()
    result = runner.invoke(main, ["hello"])
    assert result.exit_code == 0
    assert "Hello, world!" in result.output


def test_hello_name():
    runner = CliRunner()
    result = runner.invoke(main, ["hello", "Alice"])
    assert result.exit_code == 0
    assert "Hello, Alice!" in result.output
